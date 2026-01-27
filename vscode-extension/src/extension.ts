import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Aiken Devtools (MCP)');

  const startCmd = vscode.commands.registerCommand('aiken-devtools.start', async () => {
    const config = vscode.workspace.getConfiguration('aikenDevtools');
    const allow = config.get<string[]>('allowTools') || [];

    // collect flags to pass to the server
    const flags: string[] = [];
    if (allow.length) flags.push('--allow-tools', allow.join(','));

    // Keep readonly by default; if user explicitly disables it in settings, pass flag
    const noReadonly = config.get<boolean>('disableReadonly') ?? false;
    if (noReadonly) flags.push('--no-readonly');

    // If user has configured a specific projectRoot, prefer that
    const cfgProjectRoot = config.get<string>('projectRoot');
    let projectRoot: string | undefined = undefined;

    if (cfgProjectRoot) {
      // resolve relative paths against the first workspace folder, or process.cwd()
      const base = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) ? vscode.workspace.workspaceFolders[0].uri.fsPath : process.cwd();
      const resolved = path.isAbsolute(cfgProjectRoot) ? cfgProjectRoot : path.join(base, cfgProjectRoot);
      if (fs.existsSync(path.join(resolved, 'dist', 'index.js'))) {
        projectRoot = resolved;
      }
      else {
        output.appendLine(`Configured projectRoot ${resolved} does not contain dist/index.js`);
      }
    }

    // Try to find a local copy of the server (prefer workspace root that matches package name or contains dist)
    if (!projectRoot) {
      const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
      for (const wf of workspaceFolders) {
        const p = wf.uri.fsPath;
        const pkg = path.join(p, 'package.json');
        const dist = path.join(p, 'dist', 'index.js');
        if (fs.existsSync(pkg)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(pkg, 'utf8'));
            if (parsed && (parsed.name === 'aiken-devtools-mcp' || fs.existsSync(dist))) {
              projectRoot = p;
              break;
            }
          }
          catch {
            // ignore
          }
        }
        else if (fs.existsSync(dist)) {
          projectRoot = p;
          break;
        }
      }

      // fallback to current working directory
      if (!projectRoot && fs.existsSync(path.join(process.cwd(), 'dist', 'index.js'))) projectRoot = process.cwd();
    }

    let child;
    if (projectRoot && fs.existsSync(path.join(projectRoot, 'dist', 'index.js'))) {
      const local = path.join(projectRoot, 'dist', 'index.js');
      output.appendLine(`Spawning local node: ${process.execPath} ${local} ${flags.join(' ')}`);
      child = spawn(process.execPath, [local, ...flags], { cwd: projectRoot, stdio: 'pipe' });
    }
    else {
      output.appendLine(`Spawning: npx aiken-devtools-mcp ${flags.join(' ')}`);
      child = spawn('npx', ['aiken-devtools-mcp', ...flags], { stdio: 'pipe' });

      // If npx fallback fails, provide a helpful message (package is not published usually)
      child.on('exit', (code) => {
        output.appendLine(`Server exited with ${code}`);
        if (!projectRoot && code !== 0) {
          vscode.window.showErrorMessage('Failed to start via npx. The package "aiken-devtools-mcp" is not published. To run locally, build the project in your workspace (npm install && npm run build) or set "aikenDevtools.projectRoot" to point to the project root.');
        }
      });
    }

    child.on('error', (err: Error) => output.appendLine(`Failed to start server: ${err.message}`));
    child.stdout?.on('data', (chunk) => output.appendLine(chunk.toString()));
    child.stderr?.on('data', (chunk) => output.appendLine(chunk.toString()));
    // child 'exit' already handled in the npx branch above and for local spawn below
    if (projectRoot) child.on('exit', (code) => output.appendLine(`Server exited with ${code}`));

    vscode.window.showInformationMessage('Aiken Devtools MCP started (check Output panel).');
  });

  context.subscriptions.push(startCmd, output);
}

export function deactivate() {
  // no-op
}

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

    // Try to find a local copy of the server (prefer workspace root that matches package name or contains dist)
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    let projectRoot: string | undefined;

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

    let child;
    if (projectRoot && fs.existsSync(path.join(projectRoot, 'dist', 'index.js'))) {
      const local = path.join(projectRoot, 'dist', 'index.js');
      output.appendLine(`Spawning local node: ${process.execPath} ${local} ${flags.join(' ')}`);
      child = spawn(process.execPath, [local, ...flags], { cwd: projectRoot, stdio: 'pipe' });
    }
    else {
      output.appendLine(`Spawning: npx aiken-devtools-mcp ${flags.join(' ')}`);
      child = spawn('npx', ['aiken-devtools-mcp', ...flags], { stdio: 'pipe' });
    }

    child.on('error', (err: Error) => output.appendLine(`Failed to start server: ${err.message}`));
    child.stdout?.on('data', (chunk) => output.appendLine(chunk.toString()));
    child.stderr?.on('data', (chunk) => output.appendLine(chunk.toString()));
    child.on('exit', (code) => output.appendLine(`Server exited with ${code}`));

    vscode.window.showInformationMessage('Aiken Devtools MCP started (check Output panel).');
  });

  context.subscriptions.push(startCmd, output);
}

export function deactivate() {
  // no-op
}

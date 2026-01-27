import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Aiken Devtools (MCP)');

  // status bar to show running/stopped state and offer quick actions
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'aiken-devtools.openMenu';
  statusBar.show();

  let currentChild: import('child_process').ChildProcess | null = null;
  let currentProjectRoot: string | undefined = undefined;
  let stopping = false;

  function updateStatus() {
    if (currentChild) {
      statusBar.text = '$(server) Aiken Devtools: Running';
      statusBar.tooltip = 'Aiken Devtools MCP is running. Click for actions.';
    }
    else {
      statusBar.text = '$(circle-slash) Aiken Devtools: Stopped';
      statusBar.tooltip = 'Aiken Devtools MCP is stopped. Click for actions.';
    }
  }

  async function gatherFlagsAndProjectRoot() {
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

    return { flags, projectRoot };
  }

  const startServer = async () => {
    if (currentChild) {
      const should = await vscode.window.showWarningMessage('Aiken Devtools MCP is already running. Restart?', 'Restart', 'Cancel');
      if (should !== 'Restart') return;
      await restartServer();
      return;
    }

    const { flags, projectRoot } = await gatherFlagsAndProjectRoot();

    // Check for consent if destructive tools are allowed
    const config = vscode.workspace.getConfiguration('aikenDevtools');
    const allow = config.get<string[]>('allowTools') || [];
    const requireConsent = config.get<boolean>('requireConsent') ?? false;
    if (requireConsent && allow.length > 0) {
      const toolsPath = projectRoot ? path.join(projectRoot, 'mcp-tools.json') : path.join(process.cwd(), 'mcp-tools.json');
      if (fs.existsSync(toolsPath)) {
        try {
          const content = fs.readFileSync(toolsPath, 'utf8');
          const manifest = JSON.parse(content);
          const tools = manifest.tools || [];
          const destructiveAllowed = allow.some(toolName => {
            const tool = tools.find((t: any) => t.name === toolName);
            return tool && tool.destructive;
          });
          if (destructiveAllowed) {
            const consent = await vscode.window.showWarningMessage(
              'You are allowing destructive tools. These can modify files or perform irreversible actions. Do you consent?',
              'Yes, I consent', 'Cancel'
            );
            if (consent !== 'Yes, I consent') {
              return;
            }
          }
        } catch (err) {
          // ignore, proceed
        }
      }
    }

    let child: import('child_process').ChildProcess;
    if (projectRoot && fs.existsSync(path.join(projectRoot, 'dist', 'index.js'))) {
      const local = path.join(projectRoot, 'dist', 'index.js');
      output.appendLine(`Spawning local node: ${process.execPath} ${local} ${flags.join(' ')}`);
      child = spawn(process.execPath, [local, ...flags], { cwd: projectRoot, stdio: 'pipe' });
      currentProjectRoot = projectRoot;
    }
    else {
      output.appendLine(`Spawning: npx aiken-devtools-mcp ${flags.join(' ')}`);
      child = spawn('npx', ['aiken-devtools-mcp', ...flags], { stdio: 'pipe' });
      currentProjectRoot = undefined;

      // If npx fallback fails, provide a helpful message (package is not published usually)
      child.on('exit', (code) => {
        output.appendLine(`Server exited with ${code}`);
        if (!projectRoot && code !== 0) {
          vscode.window.showErrorMessage('Failed to start via npx. The package "aiken-devtools-mcp" is not published. To run locally, build the project in your workspace (npm install && npm run build) or set "aikenDevtools.projectRoot" to point to the project root.');
        }
      });
    }

    currentChild = child;
    updateStatus();

    child.on('error', (err: Error) => {
      output.appendLine(`Failed to start server: ${err.message}`);
      currentChild = null;
      updateStatus();
    });

    child.stdout?.on('data', (chunk) => output.appendLine(chunk.toString()));
    child.stderr?.on('data', (chunk) => output.appendLine(chunk.toString()));

    child.on('exit', (code, signal) => {
      output.appendLine(`Server exited with ${code} ${signal ? `signal=${signal}` : ''}`);
      currentChild = null;
      updateStatus();
    });

    vscode.window.showInformationMessage('Aiken Devtools MCP started (check Output panel).');
  }

  const stopServer = async (timeout = 5000) => {
    if (!currentChild) {
      vscode.window.showInformationMessage('Aiken Devtools MCP is not running.');
      return true;
    }

    if (stopping) return false;
    stopping = true;

    output.appendLine('Stopping Aiken Devtools MCP...');

    return await new Promise<boolean>((resolve) => {
      let resolved = false;

      const onExit = () => {
        if (resolved) return;
        resolved = true;
        stopping = false;
        currentChild = null;
        updateStatus();
        output.appendLine('Aiken Devtools MCP stopped.');
        resolve(true);
      };

      currentChild!.once('exit', onExit);

      try {
        // ask nicely first
        currentChild!.kill('SIGINT');
      }
      catch (e) {
        // ignore
      }

      const t1 = setTimeout(() => {
        if (resolved) return;
        try { currentChild!.kill('SIGTERM'); } catch { }
      }, 3000);

      const t2 = setTimeout(() => {
        if (resolved) return;
        try { currentChild!.kill('SIGKILL'); } catch { }
      }, timeout);

      // fallback: if child already exited, onExit will resolve
    });
  }

  const showTools = async () => {
    const { projectRoot } = await gatherFlagsAndProjectRoot();
    const toolsPath = projectRoot ? path.join(projectRoot, 'mcp-tools.json') : path.join(process.cwd(), 'mcp-tools.json');
    if (!fs.existsSync(toolsPath)) {
      vscode.window.showErrorMessage(`mcp-tools.json not found at ${toolsPath}`);
      return;
    }
    try {
      const content = fs.readFileSync(toolsPath, 'utf8');
      const manifest = JSON.parse(content);
      const tools = manifest.tools || [];
      const categories: { [key: string]: any[] } = {};
      for (const tool of tools) {
        const category = tool.category || 'Uncategorized';
        if (!categories[category]) categories[category] = [];
        categories[category].push(tool);
      }
      const items: vscode.QuickPickItem[] = [];
      for (const category in categories) {
        items.push({ label: `--- ${category} ---`, kind: vscode.QuickPickItemKind.Separator });
        for (const tool of categories[category]) {
          items.push({
            label: tool.name,
            description: tool.description,
            detail: tool.destructive ? 'Destructive' : 'Safe'
          });
        }
      }
      const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Select a tool to view details' });
      if (pick && pick.label.startsWith('---')) return; // separator
      if (pick) {
        const tool = tools.find((t: any) => t.name === pick.label);
        if (tool) {
          const details = `Name: ${tool.name}\nDescription: ${tool.description}\nDestructive: ${tool.destructive ? 'Yes' : 'No'}\nInput Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`;
          vscode.window.showInformationMessage(details, { modal: true });
        }
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to parse mcp-tools.json: ${err}`);
    }
  }

  const restartServer = async () => {
    await stopServer();
    await startServer();
  };

  // Commands
  const startCmd = vscode.commands.registerCommand('aiken-devtools.start', async () => startServer());
  const stopCmd = vscode.commands.registerCommand('aiken-devtools.stop', async () => stopServer());
  const restartCmd = vscode.commands.registerCommand('aiken-devtools.restart', async () => restartServer());
  const showLogsCmd = vscode.commands.registerCommand('aiken-devtools.showLogs', () => output.show(true));
  const showToolsCmd = vscode.commands.registerCommand('aiken-devtools.showTools', async () => showTools());

  const openMenuCmd = vscode.commands.registerCommand('aiken-devtools.openMenu', async () => {
    const pick = await vscode.window.showQuickPick([
      { label: 'Start Server', id: 'start' },
      { label: 'Stop Server', id: 'stop' },
      { label: 'Restart Server', id: 'restart' },
      { label: 'Show Logs', id: 'logs' },
      { label: 'Show Tools', id: 'tools' }
    ]);
    if (!pick) return;
    if (pick.id === 'start') await startServer();
    if (pick.id === 'stop') await stopServer();
    if (pick.id === 'restart') await restartServer();
    if (pick.id === 'logs') output.show(true);
    if (pick.id === 'tools') await showTools();
  });

  context.subscriptions.push(startCmd, stopCmd, restartCmd, showLogsCmd, openMenuCmd, showToolsCmd, output, statusBar);

  // ensure the server is stopped if extension is deactivated
  context.subscriptions.push({
    dispose: () => {
      if (currentChild) {
        try {
          currentChild.kill('SIGKILL');
        }
        catch {
          // ignore
        }
      }
    }
  });

  updateStatus();
}


export function deactivate() {
  // no-op
}

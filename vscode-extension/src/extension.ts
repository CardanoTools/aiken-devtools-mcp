import * as vscode from 'vscode';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('Aiken Devtools (MCP)');

  const startCmd = vscode.commands.registerCommand('aiken-devtools.start', async () => {
    const config = vscode.workspace.getConfiguration('aikenDevtools');
    const allow = config.get<string[]>('allowTools') || [];

    const args = ['aiken-devtools-mcp'];
    if (allow.length) args.push('--allow-tools', allow.join(','));

    // Keep readonly by default; if user explicitly disables it in settings, pass flag
    const noReadonly = config.get<boolean>('disableReadonly') ?? false;
    if (noReadonly) args.push('--no-readonly');

    output.appendLine(`Spawning: npx ${args.join(' ')}`);
    const child = spawn('npx', args, { stdio: 'pipe' });

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

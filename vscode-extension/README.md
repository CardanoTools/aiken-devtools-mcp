# Aiken Devtools VS Code extension (skeleton)

This is a small VS Code extension skeleton that demonstrates how to spawn the MCP server via `npx aiken-devtools-mcp` and pass a list of allowed tools from the VS Code workspace settings.

Features
- Command `Aiken Devtools: Start` (command id `aiken-devtools.start`) starts a local `dist/index.js` server when present (preferred), otherwise falls back to `npx aiken-devtools-mcp` and shows logs to an Output panel.
- Configure settings in Workspace Settings under `aikenDevtools.allowTools` (string array) and `aikenDevtools.disableReadonly` (boolean) to control server flags.
- Optional: set `aikenDevtools.projectRoot` to a workspace-relative or absolute path to explicitly choose the server project root (useful in multi-root workspaces).

This is a minimal starting point; a production extension should implement:
- Proper lifecycle management (stop command, restart, long-running cleanup)
- A UI to request user consent when a tool requests destructive actions
- Integration with the MCP client to discover tools and display manifest & statuses

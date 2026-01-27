# Copilot Instructions for aiken-devtools-mcp

Welcome, AI coding agents! This guide distills the essential knowledge and patterns for working productively in this codebase.

## Architecture Overview
- **Purpose:** Provides Model Context Protocol (MCP) tools for developing, integrating, and auditing Aiken smart contracts.
- **Key Components:**
  - `src/`: Core server, tool implementations, and knowledge integration logic.
  - `scripts/`: Node.js scripts for tool search, ingestion, and automation.
  - `mcp-tools.json` / `mcp-policy.json`: Tool manifest and admin policy for tool access and restrictions.
  - `var/vectors/`: Vector store for knowledge search.
  - `vscode-extension/`: VS Code extension for launching the MCP server and tool consent UI.

## Developer Workflows
- **Install dependencies:** `npm install`
- **Build:** `npm run build`
- **Run server:** `npm start` (stdio MCP server)
- **Run with tool allowlist:** `npx aiken-devtools-mcp --allow-tools <tool>`
- **Test:** (No explicit test script; see `scripts/` for integration tests)
- **Import Awesome Aiken:** `npm run import:awesome` then `npx mcp run aiken_knowledge_sync`

## Tooling & Patterns
- **MCP Tools:** Defined in `mcp-tools.json`, implemented in `src/`. Exposed via CLI and MCP server.
- **Knowledge Sync/Search:** Use `aiken_knowledge_sync` to fetch docs/libraries, and `aiken_knowledge_search` to query them. Cached in `.aiken-devtools-cache/`.
- **Blueprint Integration:** Use `aiken_blueprint_*` tools to inspect, hash, and export validator blueprints. See integration bundle tools for multi-step flows.
- **Codegen:** Prefer `aiken_codegen_evolution_sdk` for generating TypeScript snippets for Evolution SDK integration.
- **Dynamic Toolsets:** Enable/disable toolsets at runtime with `--toolsets` or `AIKEN_TOOLSETS` env var. Use `--dynamic-toolsets` for runtime toggling.
- **Audit & Policy:** All tool calls are logged to `audit.log` (sensitive fields redacted). Use `mcp-policy.json` to restrict tool access.

## Project Conventions
- **Readonly by default:** Server starts in readonly mode; destructive tools require explicit allowlist.
- **Generated files:** Some files in `src/knowledge/` are auto-generated (e.g., `awesomeAiken.ts`).
- **Minimal VS Code extension:** See `vscode-extension/` for a starter extension that launches the MCP server.

## Examples
- See `README.md` for detailed tool input/output examples and workflow guidance.
- Use `scripts/tool-search.js` or the `aiken_tool_search` MCP tool to discover available tools.

## Key Files & Directories
- `src/` — Core logic and tool implementations
- `scripts/` — Automation and integration scripts
- `mcp-tools.json` — Tool manifest
- `mcp-policy.json` — Tool access policy
- `var/vectors/` — Vector store for knowledge search
- `vscode-extension/` — VS Code integration

---
For more, see the project [README.md](../README.md) and in-code comments. When in doubt, prefer the established tool and workflow patterns described above.

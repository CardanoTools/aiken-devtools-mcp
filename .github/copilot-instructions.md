# Copilot instructions — aiken-devtools-mcp

Short, actionable notes for AI coding agents working in this repository.

Quick start
- Install deps: `npm install`
- Build: `npm run build`
- Run MCP server (stdio): `npm start`
- Common run flags: `--no-readonly`, `--allow-tools aiken_knowledge_add`, `--toolsets project,knowledge`, `--dynamic-toolsets`, `--insiders`, `--lockdown`

Architecture snapshot (what to read first)
- `src/index.ts` — CLI entry: parses flags, sets runtimeConfig and starts transport.
- `src/server.ts` — composes the MCP server, registers prompts/resources and calls all `register*` tool functions.
- `src/serverWrapper.ts` — policy & audit wrapper: enforces readonly/lockdown/toolset rules and wires `mcp-tools.json` metadata.
- `src/tools/**` — tool implementations (each exports a `register...` function the server imports). See `src/tools/project/aikenBuild.ts` for a canonical example (zod schemas + annotations).
- `mcp-tools.json` — manifest + toolsets map used by the wrapper to enable/disable tools.

How to add or change an MCP tool (practical steps)
1. Add a `tools` entry to `mcp-tools.json` (set `name`, `safety`, `category` and optionally `insiders`).
2. Implement a registration function at `src/tools/<category>/aikenYourTool.ts` following existing patterns: export `registerAikenYourTool(server: McpServer)`, use `server.registerTool(name, { inputSchema, outputSchema, annotations }, handler)` and prefer `zod` schemas.
3. Import and call your `register...` from `src/server.ts` so it appears in the runtime server.
4. Update `toolsets` in `mcp-tools.json` if the tool belongs to a named toolset and add integration tests under `scripts/`.

Runtime & policy notes (important for automation)
- Server is readonly by default; destructive or commit-like actions are blocked unless `--no-readonly` or `--allow-tools` is used.
- `attachPolicyWrapper` (in `src/serverWrapper.ts`) enforces `mcp-policy.json`, `runtimeConfig` flags, `insiders` and `lockdown` behaviors and records calls via `src/audit/log.ts`.
- Tools have `safety` tags in `mcp-tools.json` (e.g., `network`, `destructive`, `safe`) — the wrapper consults these.

Knowledge & ingestion
- `aiken_knowledge_sync`, `aiken_knowledge_ingest` and `aiken_knowledge_index` operate on a local cache/vector store under `var/vectors/` and can download large repos — run them deliberately and preferably in non-lockdown/dev-machine.
- Use `npm run import:awesome` to generate `src/knowledge/awesome/awesomeAiken.ts` then run `npx mcp run aiken_knowledge_sync` to clone/cache sources.

Testing and developer tasks
- Integration/test scripts live in `scripts/` (many are plain Node scripts, e.g. `scripts/test_tool_search.js`). There is no single `npm test` wrapper — inspect/execute the script you need.
- VS Code extension packaging task: see the workspace task "Package VS Code Extension" (runs `vscode-extension/npm install && npm run package`).

Files to inspect for common patterns
- `src/server.ts`, `src/serverWrapper.ts`, `src/index.ts`, `mcp-tools.json`, `mcp-policy.json`, `src/tools/**`, `scripts/*`, `README.md`.

Notes & conventions
- Prefer adding zod input/output schemas and tool `annotations` (readOnlyHint/idempotentHint/destructiveHint) to make tools self-describing.
- Keep changes small and respect the manifest: update `mcp-tools.json` alongside any new tool registration to keep metadata consistent for the wrapper.
- Audit logs are written to `audit.log` (sensitive fields are redacted).

If any section is unclear or you want examples expanded (e.g., a sample `register` implementation or a checklist for adding tests), tell me which area to expand and I will update this file.

Example — register a minimal MCP tool

Below is a canonical minimal tool registration (TypeScript). Put this in `src/tools/<category>/aikenExample.ts` and import + call it from `src/server.ts`.

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const inputSchema = z.object({ name: z.string().describe("A name for the example") }).strict();
const outputSchema = z.object({ message: z.string() }).strict();

export function registerAikenExampleTool(server: McpServer): void {
	server.registerTool(
		"aiken_example",
		{
			title: "Aiken: example",
			description: "Small example tool showing patterns used in this repo.",
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
				idempotentHint: true,
				destructiveHint: false
			}
		},
		async ({ name }) => {
			return { message: `hello ${name}` };
		}
	);
}
```

Register it in `src/server.ts`:

```ts
import { registerAikenExampleTool } from "./tools/project/aikenExample.js";
// ...
registerAikenExampleTool(server);
```

This pattern uses `zod` input/output schemas and `annotations` to make tools self-describing for clients and the `attachPolicyWrapper` to apply safety/readonly rules.

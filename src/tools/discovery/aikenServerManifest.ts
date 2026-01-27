import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";

export function registerAikenServerManifestTool(server: McpServer): void {
  server.registerTool(
    "aiken_server_manifest",
    {
      title: "Aiken: server manifest",
      description: "Return the local MCP tool manifest (mcp-tools.json)",
      annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => {
      try {
        const p = path.join(process.cwd(), "mcp-tools.json");
        const raw = await fs.readFile(p, "utf8");
        const parsed = JSON.parse(raw);
        return { content: [{ type: "text", text: "Manifest returned" }], structuredContent: parsed };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Failed to read manifest: ${String(err)}` }] };
      }
    }
  );
}

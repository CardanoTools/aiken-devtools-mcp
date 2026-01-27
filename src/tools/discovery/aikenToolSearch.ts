import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";

const inputSchema = z
  .object({
    query: z.string().min(1),
    maxResults: z.number().int().positive().optional()
  })
  .strict();

const outputSchema = z
  .object({
    tools: z.array(z.object({ name: z.string(), title: z.string().optional(), description: z.string().optional(), category: z.string().optional(), toolsets: z.array(z.string()).optional() }))
  })
  .strict();

export function registerAikenToolSearchTool(server: McpServer): void {
  server.registerTool(
    "aiken_tool_search",
    {
      title: "Aiken: tool search",
      description: "Search available tools in the server manifest by name, title or description.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false }
    },
    async ({ query, maxResults }) => {
      try {
        const raw = await fs.readFile(path.join(process.cwd(), "mcp-tools.json"), "utf8");
        const parsed = JSON.parse(raw) as { tools?: Array<Record<string, any>>, toolsets?: Record<string, string[]> };
        const tools = Array.isArray(parsed.tools) ? parsed.tools : [];

        const q = query.toLowerCase();
        const matches = tools
          .filter((t) => {
            if (!t || !t.name) return false;
            if ((t.name || "").toLowerCase().includes(q)) return true;
            if ((t.title || "").toLowerCase().includes(q)) return true;
            if ((t.description || "").toLowerCase().includes(q)) return true;
            return false;
          })
          .slice(0, maxResults ?? 20)
          .map((t) => ({ name: t.name, title: t.title, description: t.description, category: t.category, toolsets: [] as string[] }));

        // attach toolsets if provided in manifest
        if (parsed.toolsets) {
          const reverseMap: Record<string, string[]> = {};
          for (const [ts, members] of Object.entries(parsed.toolsets)) {
            if (!Array.isArray(members)) continue;
            for (const m of members) {
              reverseMap[m] = reverseMap[m] ?? [];
              (reverseMap[m] as string[]).push(ts);
            }
          }
          for (const mm of matches) {
            mm.toolsets = reverseMap[mm.name] ?? [];
          }
        }

        return { content: [{ type: "text", text: `Found ${matches.length} matches` }], structuredContent: { tools: matches } };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Tool search failed: ${String(err)}` }] };
      }
    }
  );
}

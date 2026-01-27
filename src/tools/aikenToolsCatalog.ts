import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";

const outputSchema = z
  .object({
    byCategory: z.record(z.array(z.object({ name: z.string(), title: z.string(), description: z.string().optional(), safety: z.string().optional(), category: z.string().optional() })))
  })
  .strict();

export function registerAikenToolsCatalogTool(server: McpServer): void {
  server.registerTool(
    "aiken_tools_catalog",
    {
      title: "Aiken: tools catalog",
      description: "Return a categorized listing of available tools for host discovery.",
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => {
      try {
        const p = path.join(process.cwd(), "mcp-tools.json");
        const raw = await fs.readFile(p, "utf8");
        const parsed = JSON.parse(raw) as { tools?: Array<Record<string, any>> };
        const tools = Array.isArray(parsed.tools) ? parsed.tools : [];

        const byCategory: Record<string, Array<Record<string, any>>> = {};
        for (const t of tools) {
          const cat = String(t.category ?? "uncategorized");
          if (!byCategory[cat]) byCategory[cat] = [];
          const arr = byCategory[cat] as Array<Record<string, any>>;
          arr.push(t as any);
        }

        return { content: [{ type: "text", text: "Catalog returned" }], structuredContent: { byCategory } };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Failed to read manifest: ${String(err)}` }] };
      }
    }
  );
}

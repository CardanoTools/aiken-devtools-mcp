import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";

import { emptyInputSchema, createErrorResponse, createSuccessResponse, type UnknownRecord } from "../common/utils.js";

/** Schema for tool entries in catalog */
const toolEntrySchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string().optional(),
  safety: z.enum(["safe", "destructive", "network"]).optional(),
  category: z.string().optional()
});

const outputSchema = z
  .object({
    categoryCount: z.number().int().nonnegative(),
    toolCount: z.number().int().nonnegative(),
    byCategory: z.record(z.string(), z.array(toolEntrySchema))
  })
  .strict();

export function registerAikenToolsCatalogTool(server: McpServer): void {
  server.registerTool(
    "aiken_tools_catalog",
    {
      title: "Aiken: tools catalog",
      description:
        "Returns all available tools grouped by category (project, blueprint, knowledge, codegen, discovery). " +
        "Use this to get a quick overview of tool capabilities. " +
        "For searching specific tools, use aiken_tool_search instead.",
      inputSchema: emptyInputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => {
      try {
        const manifestPath = path.join(process.cwd(), "mcp-tools.json");
        const raw = await fs.readFile(manifestPath, "utf8");
        const parsed = JSON.parse(raw) as { tools?: UnknownRecord[] };
        const tools = Array.isArray(parsed.tools) ? parsed.tools : [];

        const byCategory: Record<string, z.infer<typeof toolEntrySchema>[]> = {};
        let toolCount = 0;

        for (const t of tools) {
          if (!t || typeof t.name !== "string") continue;

          const cat = typeof t.category === "string" ? t.category : "uncategorized";
          if (!byCategory[cat]) byCategory[cat] = [];

          const entry: z.infer<typeof toolEntrySchema> = {
            name: t.name,
            title: typeof t.title === "string" ? t.title : t.name,
            description: typeof t.description === "string" ? t.description : undefined,
            safety: typeof t.safety === "string" && ["safe", "destructive", "network"].includes(t.safety)
              ? t.safety as "safe" | "destructive" | "network"
              : undefined,
            category: cat
          };

          byCategory[cat]!.push(entry);
          toolCount++;
        }

        const categoryCount = Object.keys(byCategory).length;

        return createSuccessResponse(
          `Catalog: ${toolCount} tools in ${categoryCount} categories`,
          { categoryCount, toolCount, byCategory }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return createErrorResponse(`Failed to read manifest: ${message}`);
      }
    }
  );
}

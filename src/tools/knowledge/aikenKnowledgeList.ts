import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { compactAll, findSpecById, CompactSpec } from "../../knowledge/core/registry.js";
import { ALL_KNOWLEDGE_SOURCES } from "../../knowledge/index.js";

const inputSchema = z
  .object({
    ids: z.array(z.string())
      .max(100, "Maximum 100 IDs per query")
      .optional()
      .describe("Specific knowledge source IDs to return. If empty, returns all sources matching other filters."),
    category: z
      .enum(["documentation", "library", "example"])
      .optional()
      .describe("Filter by category: 'documentation' (guides/API), 'library' (code), 'example' (samples)."),
    query: z.string()
      .min(1)
      .max(200, "Query too long")
      .optional()
      .describe("Text filter for IDs and descriptions (case-insensitive substring match)."),
    include: z.enum(["compact", "full"]).optional().describe(
      "Output format: 'compact' (minimal fields, less tokens) or 'full' (all fields). Default: 'compact'."
    ),
    limit: z.number()
      .int()
      .positive()
      .max(1000, "Maximum limit is 1000")
      .optional()
      .describe("Maximum results to return (1-1000, default: 200). Use smaller values for faster responses.")
  })
  .strict();

const compactSchema = z
  .object({
    id: z.string(),
    category: z.enum(["documentation", "library", "example"]),
    folderName: z.string(),
    subPath: z.string().optional(),
    remoteHost: z.string().optional()
  })
  .strict();

const sourceFullSchema = z
  .object({
    id: z.string(),
    remoteUrl: z.string(),
    defaultRef: z.string(),
    folderName: z.string(),
    subPath: z.string().optional(),
    description: z.string(),
    category: z.enum(["documentation", "library", "example"])
  })
  .strict();

const outputSchema = z
  .object({
    count: z.number().int(),
    truncated: z.boolean(),
    sources: z.array(z.union([compactSchema, sourceFullSchema]))
  })
  .strict();

export function registerAikenKnowledgeListTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_list",
    {
      title: "Aiken: knowledge list",
      description: "List known knowledge sources in a compact form by default to reduce token usage.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ ids, category, query, include, limit }) => {
      const effectiveInclude = include ?? "compact";
      const effectiveLimit = Math.max(1, Math.min(limit ?? 200, 1000));

      let sources = ALL_KNOWLEDGE_SOURCES.slice();

      if (ids?.length) {
        const set = new Set(ids);
        sources = sources.filter((s) => set.has(s.id));
      }

      if (category) {
        sources = sources.filter((s) => s.category === category);
      }

      if (query) {
        const q = query.toLowerCase();
        sources = sources.filter((s) => s.id.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
      }

      const truncated = sources.length > effectiveLimit;
      sources = sources.slice(0, effectiveLimit);

      let data: Array<CompactSpec | z.infer<typeof sourceFullSchema>>;

      if (effectiveInclude === "compact") {
        data = sources.map((s) => ({ id: s.id, category: s.category, folderName: s.folderName, subPath: s.subPath, remoteHost: (() => { try { return new URL(s.remoteUrl).host; } catch { return undefined; } })() }));
      } else {
        data = sources.map((s) => ({ id: s.id, remoteUrl: s.remoteUrl, defaultRef: s.defaultRef, folderName: s.folderName, subPath: s.subPath, description: s.description, category: s.category }));
      }

      const structuredContent: z.infer<typeof outputSchema> = {
        count: data.length,
        truncated,
        sources: data
      };

      return {
        content: [{ type: "text", text: `Found ${data.length} knowledge source(s).` }],
        structuredContent
      };
    }
  );
}

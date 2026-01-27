import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listProposals } from "../../knowledge/ingestion/proposals.js";

const inputSchema = z
  .object({
    query: z.string().min(1).optional().describe("Filter proposal ids or titles (case-insensitive)."),
    limit: z.number().int().positive().optional().describe("Max number of proposals to return."),
  })
  .strict();

const proposalSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    summary: z.string().optional(),
    chunks: z.number().int().nonnegative().optional(),
    path: z.string(),
    createdAt: z.number().int().optional()
  })
  .strict();

const outputSchema = z
  .object({
    count: z.number().int(),
    proposals: z.array(proposalSchema)
  })
  .strict();

export function registerAikenKnowledgeProposalsListTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_proposals_list",
    {
      title: "Aiken: knowledge proposals list",
      description: "List pending ingestion proposals under src/knowledge/proposals.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: true }
    },
    async ({ query, limit }) => {
      const all = await listProposals();
      let filtered = all;
      if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter((p) => (p.id || "").toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q));
      }
      const truncated = typeof limit === "number" && filtered.length > limit;
      const sliced = typeof limit === "number" ? filtered.slice(0, limit) : filtered;

      const structured = {
        count: sliced.length,
        proposals: sliced.map((p) => ({ id: p.id, title: p.title, summary: p.summary, chunks: p.chunks, path: p.path, createdAt: p.createdAt }))
      };

      return { content: [{ type: "text", text: `Found ${sliced.length} proposal(s).${truncated ? " (truncated)" : ""}` }], structuredContent: structured };
    }
  );
}

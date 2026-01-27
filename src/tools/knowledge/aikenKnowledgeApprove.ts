import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProposalById, approveProposal } from "../../knowledge/ingestion/proposals.js";

const inputSchema = z
  .object({
    id: z.string().min(1).describe("Proposal id to approve (filename without extension e.g., 'aiken-lang-site')."),
    commit: z.boolean().optional().describe("Whether to commit the change (default: true)."),
    archive: z.boolean().optional().describe("Whether to archive the proposal into proposals/approved (default: true)."),
    category: z.enum(["documentation", "library", "example"]).optional().describe("Optional category override for the added source."),
  })
  .strict();

const outputSchema = z
  .object({
    id: z.string(),
    committed: z.boolean()
  })
  .strict();

export function registerAikenKnowledgeApproveTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_approve",
    {
      title: "Aiken: approve knowledge proposal",
      description: "Approve a pending proposal: adds the KnowledgeSourceSpec to src/knowledge/<category>/customAdded.ts and commits if requested.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: true }
    },
    async ({ id, commit, archive, category }) => {
      const p = await getProposalById(id);
      if (!p) return { isError: true, content: [{ type: "text", text: `Proposal '${id}' not found.` }] };
      if (!p.spec) return { isError: true, content: [{ type: "text", text: `Proposal '${id}' has no valid spec.` }] };

      const res = await approveProposal(id, { commit, categoryOverride: category, archive });
      if (!res.ok) {
        return { isError: true, content: [{ type: "text", text: `Failed to approve proposal: ${(res as { ok: false; reason: string }).reason}` }] };
      }

      return { content: [{ type: "text", text: `Approved proposal '${id}'.` }], structuredContent: { id: res.id, committed: res.committed } };
    }
  );
}

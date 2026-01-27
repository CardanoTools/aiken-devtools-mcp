import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ingestUrl } from "../knowledge/ingest.js";
import { addCustomSource, ensureIndexExportsForCategory } from "../knowledge/customManager.js";
import { runGit } from "../git/runGit.js";

const inputSchema = z
  .object({
    urls: z.array(z.string().url()).optional().describe("List of web URLs to ingest."),
    gitUrls: z.array(z.string()).optional().describe("List of git repo URLs to ingest."),
    category: z.enum(["documentation", "library", "example"]).optional(),
    autoAdd: z.boolean().optional(),
    commit: z.boolean().optional(),
    summarize: z.boolean().optional(),
    renderJs: z.boolean().optional(),
    autoIndex: z.boolean().optional(),
    indexCollection: z.string().optional()
  })
  .strict();

const outputSchema = z
  .object({
    ingested: z.number().int(),
    added: z.number().int()
  })
  .strict();

export function registerAikenKnowledgeBulkIngestTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_bulk_ingest",
    {
      title: "Aiken: bulk ingest",
      description: "Ingest multiple URLs or git repos as proposals. Optional autoAdd will add them to customAdded.ts.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: true }
    },
    async ({ urls, gitUrls, category, autoAdd, commit, summarize, renderJs, autoIndex, indexCollection }) => {
      const uList = urls ?? [];
      const gList = gitUrls ?? [];
      let ingested = 0;
      let added = 0;

      for (const u of uList) {
        try {
          const r = await ingestUrl(u, { category, maxChars: 80_000, chunkSize: 3000, renderJs: !!renderJs, summarize: !!summarize, autoIndex: !!autoIndex, indexCollection });
          ingested++;
          if (autoAdd) {
            try {
              const spec = r.spec;
              const res = await addCustomSource(category ?? spec.category, spec as any);
              if (res.ok) {
                await ensureIndexExportsForCategory(category ?? spec.category);
                added++;
              }
            } catch {
              // ignore add failures
            }
          }
        } catch (err) {
          // continue
        }
      }

      // Handle git URLs by creating minimal proposals (not fetching web content)
      for (const g of gList) {
        try {
          // reuse ingest tool's git handling by calling ingestUrl with gitUrl converted to page URL (a quick heuristic)
          const r = await ingestUrl(g, { category, maxChars: 1000 });
          ingested++;
          if (autoAdd && r && r.spec) {
            const spec = r.spec;
            const res = await addCustomSource(category ?? spec.category, spec as any);
            if (res.ok) {
              await ensureIndexExportsForCategory(category ?? spec.category);
              added++;
            }
          }
        } catch {
          // ignore
        }
      }

      if ((commit ?? true) && added) {
        const ga = await runGit({ cwd: process.cwd(), args: ["add", "."], timeoutMs: 60_000 });
        if (ga.ok) {
          await runGit({ cwd: process.cwd(), args: ["commit", "-m", `chore: add bulk ingested knowledge (${added} sources)`], timeoutMs: 60_000 });
        }
      }

      return { content: [{ type: "text", text: `Ingested ${ingested} items, ${added} added.` }], structuredContent: { ingested, added } };
    }
  );
}

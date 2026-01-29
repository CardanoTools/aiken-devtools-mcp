import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ingestUrl } from "../../knowledge/ingestion/ingest.js";
import { addCustomSource, ensureIndexExportsForCategory } from "../../knowledge/ingestion/customManager.js";
import { runGit } from "../../git/runGit.js";

const inputSchema = z
  .object({
    urls: z.array(z.string().url())
      .max(50, "Maximum 50 URLs per batch")
      .optional()
      .describe("List of web page URLs to fetch, convert to markdown, and propose as knowledge sources."),
    gitUrls: z.array(z.string())
      .max(20, "Maximum 20 git repos per batch")
      .optional()
      .describe("List of git repository URLs (GitHub, GitLab, etc.) to propose as knowledge sources."),
    category: z.enum(["documentation", "library", "example"]).optional()
      .describe("Category for all ingested sources: 'documentation' (guides/API docs), 'library' (code libs), 'example' (sample projects). Default: 'documentation'."),
    autoAdd: z.boolean().optional()
      .describe("If true, automatically add proposals to customAdded.ts without manual review. Default: false."),
    commit: z.boolean().optional()
      .describe("When autoAdd is true, commit the changes to git. Default: true."),
    summarize: z.boolean().optional()
      .describe("Generate AI summaries for each source (requires SUMMARIZER_PROVIDER env var). Default: false."),
    renderJs: z.boolean().optional()
      .describe("Use Playwright to render JavaScript-heavy pages before extraction. Slower but better for SPAs. Default: false."),
    autoIndex: z.boolean().optional()
      .describe("Compute embeddings and add to vector store (requires EMBEDDING_PROVIDERS env var). Default: false."),
    indexCollection: z.string()
      .max(100, "Collection name too long")
      .optional()
      .describe("Name for the vector store collection. Default: uses each source's ID.")
  })
  .strict()
  .refine(
    (data) => (data.urls && data.urls.length > 0) || (data.gitUrls && data.gitUrls.length > 0),
    { message: "At least one URL or gitUrl is required" }
  );

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

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";

import { getProposalById, listProposals } from "../../knowledge/ingestion/proposals.js";
import { getEmbeddingWithProvider } from "../../knowledge/storage/embeddings.js";
import { upsertVectors } from "../../knowledge/storage/vectorStoreFile.js";
import { ALL_KNOWLEDGE_SOURCES } from "../../knowledge/index.js";
import { resolveSourceDirPath } from "../../knowledge/core/utils.js";
import { chunkText } from "../../knowledge/ingestion/ingest.js";

const inputSchema = z
  .object({
    proposalId: z.string().optional().describe("Proposal id to index (e.g., 'aiken-lang-site')."),
    sourceId: z.string().optional().describe("Existing knowledge source id to index (must be synced already)."),
    collection: z.string().optional().describe("Target collection name for vectors (default: source id or 'proposals')."),
    chunkSize: z.number().int().positive().optional(),
    overlap: z.number().int().nonnegative().optional()
  })
  .strict();

const outputSchema = z
  .object({
    indexed: z.number().int(),
    collection: z.string()
  })
  .strict();

export function registerAikenKnowledgeIndexTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_index",
    {
      title: "Aiken: knowledge index",
      description: "Index a proposal or a synced knowledge source into the local vector store (file-based). Uses configured embedding providers (OpenAI, Anthropic/Claude, Cohere, GitHub Copilot, or fallback pseudo embeddings). Configure providers via environment variables (EMBEDDING_PROVIDERS and provider-specific keys).",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: true }
    },
    async ({ proposalId, sourceId, collection, chunkSize, overlap }) => {
      const effectiveChunkSize = chunkSize ?? 3000;
      const effectiveOverlap = overlap ?? 200;

      const records: Array<{ id: string; vector: number[]; metadata: Record<string, any> }> = [];
      let coll = collection ?? "proposals";

      if (proposalId) {
        const p = await getProposalById(proposalId);
        if (!p) return { isError: true, content: [{ type: "text", text: `Proposal '${proposalId}' not found.` }] };

        coll = collection ?? `proposal-${proposalId}`;

        // Read full content from the proposal file's markdown block
        try {
          const raw = await fs.readFile(p.path, "utf8");
          const mdMatch = raw.match(/```markdown\n([\s\S]*?)\n```/i);
          const text = (mdMatch && mdMatch[1]) ? mdMatch[1] : (p.summary ?? "");
          const chunks = chunkText(text, effectiveChunkSize, effectiveOverlap);

          for (let i = 0; i < chunks.length; i++) {
            const c = chunks[i] ?? "";
            if (!c) continue;
            const embRes = await getEmbeddingWithProvider(c, { allowPseudo: true });
            if (!embRes || !embRes.vector) continue;
            records.push({ id: `${proposalId}#${i}`, vector: embRes.vector, metadata: { proposalId, index: i, text: c.slice(0, 256), provider: embRes.provider, pseudo: !!embRes.pseudo } });
          }
        } catch (err) {
          return { isError: true, content: [{ type: "text", text: `Failed to read proposal: ${String(err)}` }] };
        }
      }

      if (sourceId) {
        const spec = ALL_KNOWLEDGE_SOURCES.find(s => s.id === sourceId);
        if (!spec) return { isError: true, content: [{ type: "text", text: `Source '${sourceId}' not found.` }] };

        coll = collection ?? sourceId;

        // Choose to index files under the resolved source dir (if present)
        const root = resolveSourceDirPath(spec);
        try {
          const stat = await fs.stat(root).catch(() => undefined);
          if (!stat || !stat.isDirectory()) {
            return { isError: true, content: [{ type: "text", text: `Source '${sourceId}' not available locally. Run aiken_knowledge_sync first.` }] };
          }

          // Walk files (simple recursion)
          const queue = [root];
          while (queue.length) {
            const dir = queue.shift()!;
            const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [] as any[]);
            for (const e of entries) {
              const full = path.join(dir, e.name);
              if (e.isDirectory()) {
                if (e.name === '.git' || e.name === 'node_modules' || e.name === 'dist') continue;
                queue.push(full);
                continue;
              }
              if (e.isFile()) {
                const ext = path.extname(e.name).toLowerCase();
                if (!['.md', '.markdown', '.ak', '.txt', '.toml'].includes(ext)) continue;
                const raw = await fs.readFile(full, 'utf8').catch(() => '');
                const chunks = chunkText(raw, effectiveChunkSize, effectiveOverlap);
                for (let i = 0; i < chunks.length; i++) {
                  const c = chunks[i] ?? '';
                  if (!c) continue;
                  const embRes = await getEmbeddingWithProvider(c, { allowPseudo: true });
                  if (!embRes || !embRes.vector) continue;
                  records.push({ id: `${sourceId}:${path.relative(root, full)}#${i}`, vector: embRes.vector, metadata: { sourceId, file: path.relative(root, full), index: i, text: c.slice(0, 256), provider: embRes.provider, pseudo: !!embRes.pseudo } });
                }
              }
            }
          }
        } catch (err) {
          return { isError: true, content: [{ type: "text", text: `Error indexing source: ${String(err)}` }] };
        }
      }

      if (!records.length) return { isError: true, content: [{ type: "text", text: "No chunks were prepared for indexing or embeddings are unavailable (check EMBEDDING_PROVIDERS and provider credentials)." }] };

      try {
        const count = await upsertVectors(coll, records as any);
        return { content: [{ type: "text", text: `Indexed ${count} vectors to collection '${coll}'.` }], structuredContent: { indexed: count, collection: coll } };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Failed to upsert vectors: ${String(err)}` }] };
      }
    }
  );
}

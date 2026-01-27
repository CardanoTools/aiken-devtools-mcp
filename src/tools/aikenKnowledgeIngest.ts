import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "node:path";
import fs from "node:fs/promises";

import { ingestUrl } from "../knowledge/ingest.js";
import { addCustomSource, ensureIndexExportsForCategory, type Category } from "../knowledge/customManager.js";
import { runGit } from "../git/runGit.js";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeGithubUrl(u: string): { remoteUrl: string; owner?: string; repo?: string; ref?: string; subPath?: string } {
  try {
    const url = new URL(u);
    if (url.hostname.toLowerCase().includes("github.com")) {
      const parts = url.pathname.replace(/^\//, "").split("/");
      if (parts.length >= 2) {
        const owner = parts[0] ?? "";
        const repo = (parts[1] ?? "").replace(/\.git$/, "");
        // detect tree/blob
        let ref: string | undefined;
        let subPath: string | undefined;
        if (parts.length >= 4 && (parts[2] === "tree" || parts[2] === "blob")) {
          ref = parts[3];
          if (parts.length > 4) subPath = parts.slice(4).join("/");
        }
        return { remoteUrl: `https://github.com/${owner}/${repo}.git`, owner, repo, ref, subPath };
      }
    }
  } catch (e) {
    // ignore
  }
  return { remoteUrl: u };
}

const inputSchema = z
  .object({
    url: z.string().url().optional().describe("Web page URL to ingest (recommended)."),
    gitUrl: z.string().optional().describe("Git repo URL to import as a knowledge source (optional)."),
    category: z.enum(["documentation", "library", "example"]).optional().describe("Category hint for the proposed source."),
    autoAdd: z.boolean().optional().describe("If true, automatically add the proposed source to customAdded.ts (default: false)."),
    commit: z.boolean().optional().describe("When autoAdd is used, commit the change to git (default: true)."),
    runSync: z.boolean().optional().describe("When autoAdd is used, attempt to run a sync after adding (best-effort, may be a no-op)."),
    fetchOptions: z.object({ maxChars: z.number().int().positive().optional(), chunkSize: z.number().int().positive().optional() }).optional(),
    renderJs: z.boolean().optional().describe("If true, render JS with Playwright before extracting content."),
    summarize: z.boolean().optional().describe("If true, generate a short summary using configured summarizer (OPENAI_API_KEY or fallback)."),
    autoIndex: z.boolean().optional().describe("If true, compute embeddings for chunks and store in local vector store (OPENAI_API_KEY required)."),
    indexCollection: z.string().optional().describe("Optional collection name for the vector store (defaults to spec.id).")
  })
  .strict();

const proposalSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    summary: z.string(),
    chunks: z.number().int().nonnegative(),
    proposalPath: z.string().optional(),
    spec: z.any()
  })
  .strict();

const outputSchema = z
  .object({
    proposals: z.array(proposalSchema),
    added: z.array(z.string()).optional()
  })
  .strict();

export function registerAikenKnowledgeIngestTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_ingest",
    {
      title: "Aiken: knowledge ingest",
      description: "Ingest a web page or Git repo and propose a KnowledgeSourceSpec (convert → chunk → propose). Optionally auto-add the proposal to src/knowledge/<category>/customAdded.ts.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ url, gitUrl, category: categoryIn, autoAdd, commit, runSync, fetchOptions, renderJs, summarize, autoIndex, indexCollection }) => {
      const category = (categoryIn ?? "documentation") as Category;

      if (!url && !gitUrl) {
        return { isError: true, content: [{ type: "text", text: "Please provide at least a url or gitUrl to ingest." }] };
      }

      const proposals: Array<z.infer<typeof proposalSchema>> = [];

      if (url) {
        try {
          const res = await ingestUrl(url, { category, maxChars: fetchOptions?.maxChars, chunkSize: fetchOptions?.chunkSize, renderJs: !!renderJs, summarize: !!summarize, autoIndex: !!autoIndex, indexCollection });
          proposals.push({ id: res.id, title: res.title, summary: res.summary, chunks: res.chunks.length, proposalPath: res.proposalPath, spec: res.spec });
        } catch (err) {
          return { isError: true, content: [{ type: "text", text: `Failed to ingest url '${url}': ${(err instanceof Error && err.message) || String(err)}` }] };
        }
      }

      if (gitUrl) {
        // create a lightweight proposal for git repos
        const norm = normalizeGithubUrl(gitUrl);
        const owner = (norm as any).owner as string | undefined;
        const repo = (norm as any).repo as string | undefined;
        const id = owner && repo ? `${slugify(owner)}-${slugify(repo)}` : slugify(gitUrl);
        const folderName = owner && repo ? `${owner}-${repo}` : slugify(id);
        const defaultRef = (norm as any).ref ?? "main";
        const spec: any = {
          id,
          remoteUrl: norm.remoteUrl,
          defaultRef,
          folderName,
          subPath: norm.subPath,
          description: `${id} (ingested from ${gitUrl})`,
          category
        };

        // write a minimal proposal file
        try {
          const proposalsDir = path.join(process.cwd(), "src", "knowledge", "proposals");
          await fs.mkdir(proposalsDir, { recursive: true });
          const filename = `${slugify(id)}-git.md`;
          const proposalPath = path.join(proposalsDir, filename);
          const content = `# Proposal: ${id}\n\nGit URL: ${gitUrl}\n\nSpec:\n\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n`;
          await fs.writeFile(proposalPath, content, "utf8");
          proposals.push({ id, title: `${id} (git)`, summary: `Proposed import of git repository ${gitUrl}`, chunks: 0, proposalPath, spec });
        } catch (err) {
          // fallback to in-memory proposal
          proposals.push({ id, title: `${id} (git)`, summary: `Proposed import of git repository ${gitUrl}`, chunks: 0, spec });
        }
      }

      const added: string[] = [];

      if (autoAdd) {
        for (const p of proposals) {
          const s = p.spec as any;
          // normalize missing required fields
          if (!s.defaultRef) s.defaultRef = "main";
          if (!s.folderName) s.folderName = slugify(s.id ?? p.id);
          if (!s.description) s.description = `${s.id} (added)`;
          try {
            const r = await addCustomSource(category, s);
            if (!r.ok) {
              // already exists -> ignore
              continue;
            }
            const ensured = await ensureIndexExportsForCategory(category);
            if (!ensured.ok) {
              // not fatal
            }
            added.push(s.id);
          } catch (err) {
            // ignore add failure for now
          }
        }

        if ((commit ?? true) && added.length) {
          const gitAdd = await runGit({ cwd: process.cwd(), args: ["add", "."], timeoutMs: 60_000 });
          if (gitAdd.ok) {
            const msg = `chore: add ingested knowledge sources: ${added.join(",")}`;
            const gitCommit = await runGit({ cwd: process.cwd(), args: ["commit", "-m", msg], timeoutMs: 60_000 });
            // If commit fails (no changes), ignore
          }
        }

        // runSync is best-effort; not implemented as internal call here.
      }

      const structuredContent = { proposals, added: added.length ? added : undefined } as any;

      return {
        content: [{ type: "text", text: `Ingested ${proposals.length} proposal(s). ${added.length ? `${added.length} were added.` : ""}` }],
        structuredContent
      };
    }
  );
}

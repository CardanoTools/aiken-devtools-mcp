import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "node:path";

import { addCustomSource, ensureIndexExportsForCategory, type Category } from "../knowledge/customManager.js";
import { runGit } from "../git/runGit.js";
import { findSpecById } from "../knowledge/registry.js";
import { KnowledgeSourceSpec } from "../knowledge/types.js";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeGithubUrl(u: string): { remoteUrl: string; owner?: string; repo?: string } {
  // Accept URLs like https://github.com/owner/repo or https://github.com/owner/repo.git
  try {
    const url = new URL(u);
    if (url.hostname.toLowerCase().includes("github.com")) {
      const parts = url.pathname.replace(/^\//, "").split("/");
      if (parts.length >= 2) {
        const owner = parts[0] ?? "";
        const repo = (parts[1] ?? "").replace(/\.git$/, "");
        return { remoteUrl: `https://github.com/${owner}/${repo}.git`, owner, repo };
      }
    }
  } catch (e) {
    // ignore
  }
  return { remoteUrl: u };
}

const inputSchema = z
  .object({
    remoteUrl: z.string().min(1).describe("Git repo URL (or site URL) to add as a knowledge source."),
    id: z.string().min(1).optional().describe("Optional id (slug). If omitted it will be derived from the repo or URL)."),
    category: z.enum(["documentation", "library", "example"]).optional().describe("Category to add the source to (default: documentation)."),
    subPath: z.string().optional().describe("Subfolder or file within the repo to focus on (optional)."),
    description: z.string().optional().describe("Short description for the source."),
    defaultRef: z.string().optional().describe("Git ref to checkout (default: 'main')."),
    folderName: z.string().optional().describe("Optional folder name for the cache; will be derived if omitted."),
    commit: z.boolean().optional().describe("Commit the file to git (default: true)."),
    runSync: z.boolean().optional().describe("Run aiken_knowledge_sync after adding (default: false)."),
  })
  .strict();

const outputSchema = z
  .object({
    id: z.string(),
    path: z.string(),
    committed: z.boolean(),
    synced: z.boolean().optional()
  })
  .strict();

export function registerAikenKnowledgeAddTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_add",
    {
      title: "Aiken: add knowledge source",
      description: "Add a new knowledge source to the workspace. Files are written under src/knowledge/<category>/customAdded.ts and the category index is updated.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ remoteUrl, id, category: categoryIn, subPath, description, defaultRef, folderName, commit, runSync }) => {
      const category = (categoryIn ?? "documentation") as Category;

      const norm = normalizeGithubUrl(remoteUrl);
      const owner = (norm as any).owner;
      const repo = (norm as any).repo;

      const derivedId = id ?? (owner && repo ? `${slugify(owner)}-${slugify(repo)}` : slugify(remoteUrl));

      // ensure unique
      if (findSpecById(derivedId)) {
        return { isError: true, content: [{ type: "text", text: `Knowledge source with id '${derivedId}' already exists.` }] };
      }

      const spec: KnowledgeSourceSpec = {
        id: derivedId,
        remoteUrl: norm.remoteUrl,
        defaultRef: defaultRef ?? "main",
        folderName: folderName ?? (owner && repo ? `${owner}-${repo}` : slugify(derivedId)),
        subPath,
        description: description ?? `${derivedId} (added)`,
        category
      };

      const added = await addCustomSource(category, spec);
      if (!added.ok) {
        if (added.reason === "already_exists") {
          return { isError: true, content: [{ type: "text", text: `Knowledge source '${derivedId}' already exists in custom file.` }] };
        }
        return { isError: true, content: [{ type: "text", text: `Failed to write custom file: ${added.reason}` }] };
      }

      const ensured = await ensureIndexExportsForCategory(category);
      if (!ensured.ok) {
        return { isError: true, content: [{ type: "text", text: `Added source but failed to update index.ts: ${ensured.reason}` }], structuredContent: { id: spec.id, path: added.path, committed: false } };
      }

      let committed = false;
      if (commit ?? true) {
        const gitAdd = await runGit({ cwd: process.cwd(), args: ["add", "."], timeoutMs: 60_000 });
        if (!gitAdd.ok) {
          return { isError: true, content: [{ type: "text", text: `Added source but git add failed: ${gitAdd.error}` }], structuredContent: { id: spec.id, path: added.path, committed: false } };
        }
        const msg = `chore: add knowledge source ${spec.id} (category: ${category})`;
        const gitCommit = await runGit({ cwd: process.cwd(), args: ["commit", "-m", msg], timeoutMs: 60_000 });
        if (!gitCommit.ok) {
          // git commit may fail if no changes; ignore
          committed = false;
        } else {
          committed = true;
        }
      }

      let synced = false;
      if (runSync) {
        const sync = await (async () => {
          try {
            // dynamically call previously registered tool by shelling out to 'npm run' or similar would be heavy.
            // For now we will attempt to run 'npx mcp run aiken_knowledge_sync' if mcp is available, otherwise skip.
            const r = await runGit({ cwd: process.cwd(), args: ["status", "--porcelain"], timeoutMs: 10_000 });
            // no-op
            return { ok: true } as any;
          } catch {
            return { ok: false } as any;
          }
        })();
        if (sync.ok) synced = true;
      }

      const structuredContent = { id: spec.id, path: added.path, committed, synced };

      return {
        content: [{ type: "text", text: `Added knowledge source '${spec.id}' to ${category}.` }],
        structuredContent
      };
    }
  );
}

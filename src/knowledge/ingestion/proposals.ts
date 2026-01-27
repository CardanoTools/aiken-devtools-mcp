import fs from "node:fs/promises";
import path from "node:path";
import { addCustomSource, ensureIndexExportsForCategory, type Category } from "./customManager.js";
import { chunkText } from "./ingest.js";
import { KnowledgeSourceSpec } from "../core/types.js";
import { runGit } from "../../git/runGit.js";
import { ALL_KNOWLEDGE_SOURCES } from "../index.js";

export type Proposal = {
  id: string;
  title?: string;
  summary?: string;
  chunks?: number;
  path: string;
  createdAt?: number;
  spec?: KnowledgeSourceSpec;
};

const PROPOSALS_DIR = path.join(process.cwd(), "src", "knowledge", "proposals");

async function parseProposalFile(filePath: string): Promise<Proposal> {
  const raw = await fs.readFile(filePath, "utf8");

  // Title line
  const titleMatch = raw.match(/^#\s*Proposal:\s*(.+)$/m);
  const title = titleMatch?.[1]?.trim();

  // Summary: take the first large paragraph after 'Summary:' heading
  const summaryMatch = raw.match(/Summary:\s*\n\n([\s\S]*?)\n\n/);
  const summary = summaryMatch?.[1]?.trim();

  // JSON spec block
  const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/i);
  let spec: KnowledgeSourceSpec | undefined = undefined;
  if (jsonMatch && typeof jsonMatch[1] === "string") {
    try {
      spec = JSON.parse(jsonMatch[1]);
    } catch {
      // ignore
    }
  }

  // Full markdown block (the full content written by ingest)
  const mdMatch = raw.match(/```markdown\n([\s\S]*?)\n```/i);
  let chunks = 0;
  if (mdMatch && mdMatch[1]) {
    const text = mdMatch[1];
    chunks = chunkText(text).length;
  }

  const stat = await fs.stat(filePath).catch(() => undefined);

  const id = path.basename(filePath).replace(/\.md$/, "");

  return {
    id,
    title,
    summary,
    chunks,
    path: filePath,
    createdAt: stat?.mtimeMs,
    spec
  };
}

export async function listProposals(): Promise<Proposal[]> {
  try {
    const entries = await fs.readdir(PROPOSALS_DIR);
    const mdFiles = entries.filter((e) => e.endsWith(".md") || e.endsWith(".markdown"));

    const list = [] as Proposal[];
    for (const f of mdFiles) {
      const p = path.join(PROPOSALS_DIR, f);
      try {
        const parsed = await parseProposalFile(p);
        list.push(parsed);
      } catch {
        // skip
      }
    }

    // sort by createdAt desc
    list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return list;
  } catch {
    return [];
  }
}

export async function getProposalById(id: string): Promise<Proposal | undefined> {
  const candidates = await listProposals();
  return candidates.find((c) => c.id === id);
}

export async function approveProposal(id: string, opts?: { commit?: boolean; categoryOverride?: Category; archive?: boolean; }): Promise<{ ok: true; id: string; committed: boolean } | { ok: false; reason: string }> {
  const p = await getProposalById(id);
  if (!p) return { ok: false, reason: `proposal '${id}' not found` };
  if (!p.spec) return { ok: false, reason: `proposal '${id}' does not contain a valid spec` };

  const archive = opts?.archive ?? true;
  const category = (opts?.categoryOverride ?? p.spec.category ?? "documentation") as Category;

  // Ensure required fields
  const spec: KnowledgeSourceSpec = {
    id: p.spec.id,
    remoteUrl: p.spec.remoteUrl,
    defaultRef: p.spec.defaultRef ?? "main",
    folderName: p.spec.folderName ?? p.spec.id,
    subPath: p.spec.subPath,
    description: p.spec.description ?? `${p.spec.id} (added)`,
    category
  };

  const added = await addCustomSource(category, spec);
  if (!added.ok) {
    if ((added as { ok: false; reason: string }).reason === "already_exists") {
      // Try to ensure index exports anyway
      await ensureIndexExportsForCategory(category);
      // Also try to update runtime registry
      if (!ALL_KNOWLEDGE_SOURCES.find(s => s.id === spec.id)) {
        (ALL_KNOWLEDGE_SOURCES as unknown as KnowledgeSourceSpec[]).push(spec);
      }
      // Archive original proposal if requested
      if (archive) {
        try {
          const archiveDir = path.join(PROPOSALS_DIR, "approved");
          await fs.mkdir(archiveDir, { recursive: true });
          const stamped = `${id}-${Date.now()}.md`;
          await fs.rename(p.path, path.join(archiveDir, stamped));
        } catch {
          // ignore archive errors
        }
      }

      return { ok: true, id: spec.id, committed: false };
    }
    return { ok: false, reason: `failed to write custom file: ${(added as { ok: false; reason: string }).reason}` };
  }

  const ensured = await ensureIndexExportsForCategory(category);
  // add to runtime registry so tools see it immediately
  if (!ALL_KNOWLEDGE_SOURCES.find(s => s.id === spec.id)) {
    (ALL_KNOWLEDGE_SOURCES as unknown as KnowledgeSourceSpec[]).push(spec);
  }

  let committed = false;
  if (opts?.commit ?? true) {
    const ga = await runGit({ cwd: process.cwd(), args: ["add", "."], timeoutMs: 60_000 });
    if (ga.ok) {
      const msg = `chore: add knowledge source ${spec.id} (via proposal)`;
      const gc = await runGit({ cwd: process.cwd(), args: ["commit", "-m", msg], timeoutMs: 60_000 });
      if (gc.ok && gc.exitCode === 0) committed = true;
    }
  }

  // Archive the original proposal if requested
  if (archive) {
    try {
      const archiveDir = path.join(PROPOSALS_DIR, "approved");
      await fs.mkdir(archiveDir, { recursive: true });
      const stamped = `${id}-${Date.now()}.md`;
      await fs.rename(p.path, path.join(archiveDir, stamped));
    } catch {
      // ignore archive errors
    }
  }

  return { ok: true, id: spec.id, committed };
}

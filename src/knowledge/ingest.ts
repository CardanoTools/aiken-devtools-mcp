import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import https from "node:https";

import type { KnowledgeSourceSpec } from "./types.js";
import type { Category } from "./customManager.js";

export type IngestOptions = {
  category?: Category;
  maxChars?: number; // max characters to keep from page
  chunkSize?: number;
  overlap?: number;
  renderJs?: boolean; // use Playwright to render JS-driven pages
  summarize?: boolean; // produce a short summarization using LLM or extractive fallback
  autoIndex?: boolean; // compute embeddings for chunks and store in local vector store
  indexCollection?: string; // name for vector collection (defaults to spec.id)
};

export type IngestResult = {
  id: string;
  title: string;
  summary: string;
  chunks: string[];
  spec: KnowledgeSourceSpec;
  proposalPath?: string;
  url: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fetchUrl(url: string, maxBytes = 200_000): Promise<{ ok: true; status: number; headers: Record<string, string | null>; body: string } | { ok: false; error: string }> {
  try {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;

    return await new Promise((resolve) => {
      const req = lib.get(url, { headers: { "user-agent": "aiken-devtools-mcp/1.0 (+https://github.com/CardanoTools/aiken-devtools-mcp)" } }, (res) => {
        const status = res.statusCode ?? 0;

        // handle redirects
        if (status >= 300 && status < 400 && res.headers.location) {
          const loc = new URL(res.headers.location, parsed).toString();
          res.resume();
          void fetchUrl(loc, maxBytes).then(resolve);
          return;
        }

        const bufs: Buffer[] = [];
        let received = 0;

        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > maxBytes) {
            req.destroy(new Error("max bytes exceeded"));
            return;
          }
          bufs.push(chunk);
        });

        res.on("end", () => {
          const body = Buffer.concat(bufs).toString("utf8");
          const headers = Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join("; ") : v ?? null]));
          resolve({ ok: true, status, headers, body });
        });

        res.on("error", (err: Error) => {
          resolve({ ok: false, error: String(err.message) });
        });
      });

      req.on("error", (err: Error) => {
        resolve({ ok: false, error: String(err.message) });
      });

      req.setTimeout(20_000, () => {
        req.destroy(new Error("timeout"));
        resolve({ ok: false, error: "timeout" });
      });
    });
  } catch (err) {
    return { ok: false, error: (err instanceof Error && err.message) || String(err) };
  }
}

import TurndownService from "turndown";

const turndown = new TurndownService({ headingStyle: "atx" });

function htmlToText(html: string): string {
  // Fallback text extraction for simple summaries; prefer Markdown where possible.
  let s = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ");

  // keep headings and paragraphs as newlines
  s = s.replace(/<(h[1-6])[^>]*>(.*?)<\/\1>/gi, (_m, _tag, inner) => "\n" + inner + "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n");

  // remove all tags
  s = s.replace(/<[^>]+>/g, " ");

  // decode a few common entities
  s = s.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/g, "'");

  // collapse whitespace
  s = s.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return s;
}

export function chunkText(text: string, chunkSize = 3000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end).trim());
    if (end === text.length) break;
    i = end - overlap;
    if (i < 0) i = end;
  }
  return chunks;
}

function extractTitleFromHtml(html: string): string | undefined {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  if (m && m[1]) return m[1].trim();
  return undefined;
}

function detectGithubRepo(url: string) {
  try {
    const u = new URL(url);
    if (!u.hostname.toLowerCase().includes("github.com")) return null;
    const parts = u.pathname.replace(/^\//, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0] ?? "";
    const repo = (parts[1] ?? "").replace(/\.git$/, "");

    // detect /tree/{ref}/{path...} or /blob/{ref}/{path...}
    let ref: string | undefined;
    let subPath: string | undefined;
    if (parts.length >= 4 && (parts[2] === "tree" || parts[2] === "blob")) {
      ref = parts[3];
      if (parts.length > 4) subPath = parts.slice(4).join("/");
    }

    return { owner, repo, ref, subPath };
  } catch {
    return null;
  }
}

export async function ingestUrl(url: string, opts: IngestOptions = {}): Promise<IngestResult> {
  const maxChars = opts.maxChars ?? 80_000;
  const chunkSize = opts.chunkSize ?? 3000;
  const overlap = opts.overlap ?? 200;
  const category = opts.category ?? ("documentation" as Category);

  // Optionally render JS-driven pages using Playwright if requested
  let html: string;
  if (opts.renderJs) {
    // dynamic import to avoid requiring playwright unless requested
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.goto(url, { timeout: 20_000 });
      html = await page.content();
      await browser.close();
    } catch (err) {
      // fallback to basic fetch
      const fetched = await fetchUrl(url, Math.max(10000, maxChars * 2));
      if (!fetched.ok) throw new Error(`Failed to fetch ${url}: ${fetched.error}`);
      html = fetched.body;
    }
  } else {
    const fetched = await fetchUrl(url, Math.max(10000, maxChars * 2));
    if (!fetched.ok) throw new Error(`Failed to fetch ${url}: ${fetched.error}`);
    html = fetched.body;
  }

  // Prefer Markdown conversion for better proposals; fallback to plain text summary when needed.
  const markdown = ((): string => {
    try {
      return turndown.turndown(html);
    } catch {
      return htmlToText(html);
    }
  })();

  const text = markdown.slice(0, maxChars);
  const chunks = chunkText(text, chunkSize, overlap);
  const title = extractTitleFromHtml(html) ?? url;

  // build a proposed KnowledgeSourceSpec
  const gh = detectGithubRepo(url);
  let spec: KnowledgeSourceSpec;
  if (gh) {
    const defaultRef = gh.ref ?? "main";
    const owner = gh.owner ?? "";
    const repo = gh.repo ?? "";
    const folderName = `${owner}-${repo}`;
    const id = `${slugify(owner)}-${slugify(repo)}`;
    spec = {
      id,
      remoteUrl: `https://github.com/${owner}/${repo}.git`,
      defaultRef,
      folderName,
      subPath: gh.subPath,
      description: `${title} (ingested from ${url})`,
      category
    };
  } else {
    const id = slugify(url);
    const folderName = id;
    spec = {
      id,
      remoteUrl: url,
      defaultRef: "main",
      folderName,
      subPath: undefined,
      description: `${title} (ingested from ${url})`,
      category
    };
  }

  // write a proposal file for human review
  const proposalsDir = path.join(process.cwd(), "src", "knowledge", "proposals");
  await fs.mkdir(proposalsDir, { recursive: true });

  let filename = `${slugify(spec.id)}.md`;
  let proposalPath: string | undefined = path.join(proposalsDir, filename);
  try {
    // avoid overwriting existing proposals by appending timestamp
    const exists = await fs.stat(proposalPath!).then(() => true).catch(() => false);
    if (exists) {
      const stamp = Date.now();
      filename = `${slugify(spec.id)}-${stamp}.md`;
      proposalPath = path.join(proposalsDir, filename);
    }

    const fileSummary = chunks.length ? (chunks[0] ?? "").slice(0, 1000) : text.slice(0, 1000);
    const content = `# Proposal: ${spec.id}\n\nURL: ${url}\n\nTitle: ${title}\n\nSummary:\n\n${fileSummary}\n\nSpec:\n\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n\nFull Markdown (first ${Math.min(32000, text.length)} chars):\n\n\`\`\`markdown\n${text.slice(0, 32000)}\n\`\`\``;

    await fs.writeFile(proposalPath, content, "utf8");
  } catch (err) {
    // If writing fails, proceed without a proposal file.
    proposalPath = undefined;
  }

  // Summarize if requested (LLM if configured, otherwise extractive fallback)
  let summary = chunks.length ? (chunks[0] ?? "").slice(0, 512) : text.slice(0, 512);
  if (opts.summarize) {
    try {
      const { summarizeText } = await import("./summarizer.js");
      summary = await summarizeText(text.slice(0, 20_000));
    } catch (err) {
      // ignore and fallback to first-chunk summary
    }
  }

  // Optionally compute embeddings and store in local vector store
  if (opts.autoIndex) {
    try {
      const { getEmbedding } = await import("./embeddings.js");
      const { upsertVectors } = await import("./vectorStoreFile.js");
      const collection = opts.indexCollection ?? spec.id;
      const records = [] as Array<{ id: string; vector: number[]; metadata: Record<string, any> }>;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i] ?? "";
        if (!chunk) continue;
        const emb = await getEmbedding(chunk);
        if (!emb) continue; // skip if embeddings not available
        records.push({ id: `${spec.id}#${i}`, vector: emb, metadata: { source: url, specId: spec.id, index: i, text: chunk.slice(0, 256) } });
      }

      if (records.length) {
        await upsertVectors(collection, records);
      }
    } catch (err) {
      // ignore indexing errors for now
    }
  }

  return {
    id: spec.id,
    title,
    summary,
    chunks,
    spec,
    proposalPath,
    url
  };
}

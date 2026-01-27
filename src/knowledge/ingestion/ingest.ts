import fs from "node:fs/promises";
import path from "node:path";
import { fetchUrl } from "../../fetch/httpClient.js";
import { checkHostSafe, isAllowedByRobots } from "../../fetch/security.js";

import type { KnowledgeSourceSpec } from "../core/types.js";
import type { Category } from "./customManager.js";
import { runtimeConfig } from "../../runtimeConfig.js";

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

export function chunkText(text: string, chunkSize = 2000, overlap = 100): string[] {
  // Token-efficient chunking: aim for ~500-800 tokens per chunk
  const targetTokens = 600; // Rough estimate: ~4 chars per token
  const effectiveChunkSize = Math.min(chunkSize, targetTokens * 4);
  const effectiveOverlap = Math.min(overlap, effectiveChunkSize / 4);

  // Split on natural boundaries when possible
  const chunks: string[] = [];
  let i = 0;

  while (i < text.length) {
    let end = Math.min(i + effectiveChunkSize, text.length);

    // Try to end at sentence boundary
    if (end < text.length) {
      const sentenceEnd = text.lastIndexOf('. ', end);
      if (sentenceEnd > i + effectiveChunkSize * 0.7) {
        end = sentenceEnd + 1;
      } else {
        // Try paragraph boundary
        const paraEnd = text.lastIndexOf('\n\n', end);
        if (paraEnd > i + effectiveChunkSize * 0.5) {
          end = paraEnd;
        }
      }
    }

    const chunk = text.slice(i, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end === text.length) break;

    // Smart overlap: don't overlap across paragraph boundaries
    const overlapStart = Math.max(i, end - effectiveOverlap);
    const nextPara = text.indexOf('\n\n', overlapStart);
    i = nextPara > overlapStart ? nextPara : end - effectiveOverlap;
  }

  return chunks.filter(chunk => chunk.length > 50); // Filter out tiny chunks
}

// Re-export a few helpers from fetch/security for tests and other consumers
export { isAllowedByRobots, parseRobotsTxt } from "../../fetch/security.js";
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

  // Enforce lockdown and robots policy checks early
  try {
    const parsedCheck = new URL(url);
    if ((parsedCheck.protocol === 'http:' || parsedCheck.protocol === 'https:') && runtimeConfig.lockdownMode) {
      throw new Error('Lockdown mode prevents ingesting remote content');
    }
    if ((parsedCheck.protocol === 'http:' || parsedCheck.protocol === 'https:') && runtimeConfig.obeyRobots) {
      const allowed = await isAllowedByRobots(url);
      if (!allowed) throw new Error(`Robots.txt disallows fetching ${url}`);
    }
  } catch (err) {
    if (err instanceof Error) throw err;
  }

  // Optionally render JS-driven pages using Playwright if requested
  let html: string;
  if (opts.renderJs) {
    // dynamic import to avoid requiring playwright unless requested
    let browser: any = undefined;
    try {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });

      const context = await browser.newContext({ userAgent: 'aiken-devtools-mcp/1.0 (+https://github.com/CardanoTools/aiken-devtools-mcp)' });
      const page = await context.newPage();

      // Intercept all requests and block heavy resources and any requests that resolve to private/loopback IPs
      try {
        await page.route('**', async (route: any) => {
          try {
            const req = route.request();
            const reqUrl = req.url();
            const resType = req.resourceType();

            // Block images/fonts/media/styles to reduce external fetching
            if (['image', 'media', 'font', 'stylesheet'].includes(resType)) {
              try {
                await route.abort();
              } catch { }
              return;
            }

            // allow non-http(s) schemes (data:, blob:, about:) to continue
            let parsed: URL | null = null;
            try {
              parsed = new URL(reqUrl);
            } catch (err) {
              try {
                await route.continue();
              } catch { }
              return;
            }

            if (parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
              try {
                await checkHostSafe(parsed.hostname);
              } catch (err) {
                // Abort requests to hosts that resolve to private IPs or fail resolution
                try {
                  await route.abort();
                } catch { }
                return;
              }
            }

            try {
              await route.continue();
            } catch {
              // ignore failures
            }
          } catch (err) {
            try {
              await route.abort();
            } catch { }
          }
        });
      } catch (e) {
        // If route interception fails, continue without it (best-effort)
      }

      // Navigate (do not wait for all network activity to avoid long waits)
      await page.goto(url, { timeout: 20_000, waitUntil: 'domcontentloaded' });
      html = await page.content();

      try {
        await context.close();
      } catch { }
      try {
        await browser.close();
      } catch { }
    } catch (err) {
      // fallback: if the URL is a data: URL, decode it; otherwise try a plain fetch
      if (browser) {
        try {
          await browser.close();
        } catch { }
      }

      try {
        const p = new URL(url);
        if (p.protocol === 'data:') {
          const idx = url.indexOf(',');
          const payload = idx >= 0 ? url.slice(idx + 1) : '';
          try {
            html = decodeURIComponent(payload);
          } catch {
            html = payload;
          }
        } else {
          const fetched = await fetchUrl(url, Math.max(10000, maxChars * 2));
          if (!fetched.ok) throw new Error(`Failed to fetch ${url}: ${(fetched as { ok: false; error: string }).error}`);
          html = fetched.body;
        }
      } catch (err2) {
        throw err2 instanceof Error ? err2 : new Error(String(err2));
      }
    }
  } else {
    const fetched = await fetchUrl(url, Math.max(10000, maxChars * 2));
    if (!fetched.ok) throw new Error(`Failed to fetch ${url}: ${(fetched as { ok: false; error: string }).error}`);
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

    const fileSummary = chunks.length ? (chunks[0] ?? "").slice(0, 500) : text.slice(0, 500);
    const content = `# Proposal: ${spec.id}\n\nURL: ${url}\n\nTitle: ${title}\n\nSummary:\n\n${fileSummary}\n\nSpec:\n\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n\nKey Sections (first 2000 chars):\n\n\`\`\`markdown\n${text.slice(0, 2000)}\n\`\`\``;

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
      const { getEmbeddingWithProvider } = await import("../storage/embeddings.js");
      const { upsertVectors } = await import("../storage/vectorStoreFile.js");
      const collection = opts.indexCollection ?? spec.id;
      const records = [] as Array<{ id: string; vector: number[]; metadata: Record<string, any> }>;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i] ?? "";
        if (!chunk) continue;
        const embRes = await getEmbeddingWithProvider(chunk, { allowPseudo: true });
        if (!embRes || !embRes.vector) continue; // skip if embeddings not available
        records.push({
          id: `${spec.id}#${i}`,
          vector: embRes.vector,
          metadata: { source: url, specId: spec.id, index: i, text: chunk.slice(0, 256), provider: embRes.provider, pseudo: !!embRes.pseudo }
        });
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

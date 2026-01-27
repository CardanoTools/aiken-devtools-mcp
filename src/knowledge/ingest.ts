import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import dns from "node:dns/promises";
import net from "node:net";

import type { KnowledgeSourceSpec } from "./types.js";
import type { Category } from "./customManager.js";
import { runtimeConfig } from "../runtimeConfig.js";

// in-memory cache for robots.txt per host
const robotsCache: Map<string, { fetchedAt: number; content: string }> = new Map();

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

    // Only support http(s) here
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: `unsupported protocol ${parsed.protocol}` };
    }

    // prevent SSRF: resolve hostname and block private/loopback addresses
    try {
      await checkHostSafe(parsed.hostname);
    } catch (err) {
      return { ok: false, error: String(err instanceof Error ? err.message : err) };
    }

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

// ---------- Safety helpers (SSRF, robots.txt) ----------
function isPrivateIp(addr: string): boolean {
  try {
    const ver = net.isIP(addr);
    if (ver === 4) {
      const parts = addr.split('.').map((s) => Number(s));
      if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
      const [a, b, c, d] = parts as [number, number, number, number];
      if (a === 10) return true;
      if (a === 127) return true;
      if (a === 169 && b === 254) return true;
      if (a === 192 && b === 168) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
      if (a === 0) return true;
      if (a >= 224) return true; // multicast/reserved
      return false;
    }

    if (ver === 6) {
      const s = addr.toLowerCase();
      if (s === '::1') return true;
      if (s.startsWith('fe80:')) return true; // link-local
      if (s.startsWith('fc') || s.startsWith('fd')) return true; // unique local
      if (s.startsWith('::ffff:')) {
        // IPv4 mapped
        const tail = s.replace('::ffff:', '');
        return isPrivateIp(tail);
      }
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

async function checkHostSafe(hostname: string): Promise<void> {
  if (!hostname) return;
  const lc = hostname.toLowerCase();
  if (lc === 'localhost' || lc === 'localhost.localdomain' || lc === 'ip6-localhost') {
    throw new Error(`host ${hostname} is local/loopback`);
  }

  // If hostname already looks like an IP, validate directly
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`host resolves to private IP: ${hostname}`);
    return;
  }

  // resolve all addresses and ensure none are private/reserved
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    if (!Array.isArray(addrs) || addrs.length === 0) return;
    for (const a of addrs) {
      const ip = String((a as any).address ?? a);
      if (isPrivateIp(ip)) throw new Error(`host resolves to private/reserved IP: ${ip}`);
    }
  } catch (err) {
    throw new Error(`failed to resolve host ${hostname}: ${String(err instanceof Error ? err.message : err)}`);
  }
}

export function parseRobotsTxt(robotsText: string, urlPath: string, userAgent = "aiken-devtools-mcp"): boolean {
  // Return true when allowed, false when disallowed. Simple prefix-based matching.
  const linesRaw = robotsText.split(/\r?\n/);
  const lines = linesRaw.map((l: string) => String(l).replace(/#.*/, '').trim()).filter(Boolean);
  type Group = { agents: string[]; allow: string[]; disallow: string[] };
  const groups: Group[] = [];
  let cur: Group | null = null;

  for (const l of lines) {
    const i = l.indexOf(":");
    if (i === -1) continue;
    const key = l.slice(0, i).trim().toLowerCase();
    const val = l.slice(i + 1).trim();
    if (key === "user-agent") {
      cur = { agents: [val.toLowerCase()], allow: [], disallow: [] };
      groups.push(cur);
    } else if (!cur) {
      // skip
    } else if (key === "allow") {
      cur.allow.push(val);
    } else if (key === "disallow") {
      cur.disallow.push(val);
    }
  }

  const ua = userAgent.toLowerCase();

  // find agent-specific group first
  let target: Group | undefined;
  for (const g of groups) {
    for (const a of g.agents) {
      if (a === ua) {
        target = g;
        break;
      }
    }
    if (target) break;
  }

  // fallback to wildcard
  if (!target) {
    for (const g of groups) {
      if (g.agents.includes('*')) {
        target = g;
        break;
      }
    }
  }

  // no rules -> allowed
  if (!target) return true;

  const tp = urlPath || '/';
  // allow rules take precedence if they match
  for (const a of target.allow) {
    if (!a) continue;
    if (tp.startsWith(a)) return true;
  }

  for (const d of target.disallow) {
    if (!d) continue;
    if (d === '/') return false;
    if (tp.startsWith(d)) return false;
  }

  return true;
}

async function isAllowedByRobots(url: string): Promise<boolean> {
  if (!runtimeConfig.obeyRobots) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;

    // ensure host is safe before attempting to fetch robots
    await checkHostSafe(parsed.hostname);

    const host = parsed.hostname;
    const now = Date.now();
    const cached = robotsCache.get(host);
    if (cached && now - cached.fetchedAt < (runtimeConfig.robotsCacheTtl ?? 600_000)) {
      return parseRobotsTxt(cached.content, parsed.pathname + (parsed.search || ''));
    }

    const robotsUrl = `${parsed.protocol}//${host}/robots.txt`;
    const fetched = await fetchUrl(robotsUrl, 16_000);
    if (!fetched.ok) {
      // treat lack of robots file as allowed
      robotsCache.set(host, { fetchedAt: now, content: '' });
      return true;
    }

    robotsCache.set(host, { fetchedAt: now, content: fetched.body });
    return parseRobotsTxt(fetched.body, parsed.pathname + (parsed.search || ''));
  } catch (err) {
    // On resolution errors we want to block higher up; but parsing failures -> allow to avoid false negatives
    if (err instanceof Error && /private|loopback|resolve/i.test(err.message)) throw err;
    return true;
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
              } catch {}
              return;
            }

            // allow non-http(s) schemes (data:, blob:, about:) to continue
            let parsed: URL | null = null;
            try {
              parsed = new URL(reqUrl);
            } catch (err) {
              try {
                await route.continue();
              } catch {}
              return;
            }

            if (parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
              try {
                await checkHostSafe(parsed.hostname);
              } catch (err) {
                // Abort requests to hosts that resolve to private IPs or fail resolution
                try {
                  await route.abort();
                } catch {}
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
            } catch {}
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
      } catch {}
      try {
        await browser.close();
      } catch {}
    } catch (err) {
      // fallback: if the URL is a data: URL, decode it; otherwise try a plain fetch
      if (browser) {
        try {
          await browser.close();
        } catch {}
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
          if (!fetched.ok) throw new Error(`Failed to fetch ${url}: ${fetched.error}`);
          html = fetched.body;
        }
      } catch (err2) {
        throw err2 instanceof Error ? err2 : new Error(String(err2));
      }
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

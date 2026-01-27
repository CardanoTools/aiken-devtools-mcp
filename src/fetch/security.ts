import dns from "node:dns/promises";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { runtimeConfig } from "../runtimeConfig.js";

export function isPrivateIp(addr: string): boolean {
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
      if (s === "::1") return true;
      if (s.startsWith("fe80:")) return true; // link-local
      if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique local
      if (s.startsWith("::ffff:")) {
        // IPv4 mapped
        const tail = s.replace("::ffff:", "");
        return isPrivateIp(tail);
      }
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

export async function checkHostSafe(hostname: string): Promise<void> {
  if (!hostname) return;
  const lc = hostname.toLowerCase();
  if (lc === "localhost" || lc === "localhost.localdomain" || lc === "ip6-localhost" || lc === "loopback") {
    throw new Error(`host ${hostname} is local/loopback`);
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`host resolves to private IP: ${hostname}`);
    return;
  }

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
  const linesRaw = (robotsText || "").split(/\r?\n/);
  const lines = linesRaw.map((l) => String(l).replace(/#.*/, "").trim()).filter(Boolean);
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
      if (g.agents.includes("*")) {
        target = g;
        break;
      }
    }
  }

  if (!target) return true;

  const tp = urlPath || "/";
  for (const a of target.allow) {
    if (!a) continue;
    if (tp.startsWith(a)) return true;
  }

  for (const d of target.disallow) {
    if (!d) continue;
    if (d === "/") return false;
    if (tp.startsWith(d)) return false;
  }

  return true;
}

const robotsCache: Map<string, { fetchedAt: number; content: string }> = new Map();

async function fetchRobots(robotsUrl: string, maxBytes = 16_000): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  try {
    const parsed = new URL(robotsUrl);
    const lib = parsed.protocol === "https:" ? https : http;

    return await new Promise((resolve) => {
      const req = lib.get(robotsUrl, { headers: { "user-agent": "aiken-devtools-mcp/1.0" } }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          const loc = new URL(res.headers.location, parsed).toString();
          res.resume();
          void fetchRobots(loc, maxBytes).then(resolve);
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
          resolve({ ok: true, body });
        });

        res.on("error", (err: Error) => {
          resolve({ ok: false, error: String(err.message) });
        });
      });

      req.on("error", (err: Error) => {
        resolve({ ok: false, error: String(err.message) });
      });

      req.setTimeout(10_000, () => {
        req.destroy(new Error("timeout"));
        resolve({ ok: false, error: "timeout" });
      });
    });
  } catch (err) {
    return { ok: false, error: (err instanceof Error && err.message) || String(err) };
  }
}

export async function isAllowedByRobots(url: string): Promise<boolean> {
  if (!runtimeConfig.obeyRobots) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;

    await checkHostSafe(parsed.hostname);

    const host = parsed.hostname;
    const now = Date.now();
    const cached = robotsCache.get(host);
    if (cached && now - cached.fetchedAt < (runtimeConfig.robotsCacheTtl ?? 10 * 60_000)) {
      return parseRobotsTxt(cached.content, parsed.pathname + (parsed.search || ""));
    }

    const robotsUrl = `${parsed.protocol}//${host}/robots.txt`;
    const fetched = await fetchRobots(robotsUrl, 16_000);
    if (!fetched.ok) {
      robotsCache.set(host, { fetchedAt: now, content: "" });
      return true;
    }

    robotsCache.set(host, { fetchedAt: now, content: fetched.body });
    return parseRobotsTxt(fetched.body, parsed.pathname + (parsed.search || ""));
  } catch (err) {
    if (err instanceof Error && /private|loopback|resolve/i.test(err.message)) throw err;
    return true;
  }
}

export function _clearRobotsCacheForTests() {
  robotsCache.clear();
}

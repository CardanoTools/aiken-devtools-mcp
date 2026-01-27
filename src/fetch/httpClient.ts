import http from "node:http";
import https from "node:https";
import { checkHostSafe } from "./security.js";

export async function fetchUrl(url: string, maxBytes = 200_000): Promise<{ ok: true; status: number; headers: Record<string, string | null>; body: string } | { ok: false; error: string }> {
  try {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: `unsupported protocol ${parsed.protocol}` };
    }

    // ensure host resolves to a safe address
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

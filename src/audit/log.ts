import fs from "node:fs/promises";
import path from "node:path";
import { runtimeConfig } from "../runtimeConfig.js";

function redact(obj: any): any {
  if (obj == null) return obj;
  if (typeof obj === "string") {
    if (obj.length > 200) return obj.slice(0, 200) + "...";
    return obj;
  }
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) return obj.map(redact);

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (/token|secret|key|password/i.test(k)) {
      out[k] = "<redacted>";
    } else if (typeof v === "string" && v.length > 200) {
      out[k] = v.slice(0, 200) + "...";
    } else if (typeof v === "object") {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function auditToolCall(toolName: string, args: any, result: any): Promise<void> {
  try {
    const file = runtimeConfig.logFilePath ?? path.join(process.cwd(), "audit.log");
    const entry = {
      time: new Date().toISOString(),
      pid: process.pid,
      tool: toolName,
      args: redact(args),
      result: redact(result)
    };
    await fs.appendFile(file, JSON.stringify(entry) + "\n", "utf8");
  } catch {
    // best-effort logging only
  }
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs";
import path from "node:path";
import { auditToolCall } from "./audit/log.js";
import { runtimeConfig, isToolAllowed } from "./runtimeConfig.js";

export function attachPolicyWrapper(server: McpServer): void {
  // Attempt to load a local manifest to extract per-tool categories for _meta
  const toolCategoryMap: Record<string, string> = {};
  try {
    const p = path.join(process.cwd(), "mcp-tools.json");
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as { tools?: Array<Record<string, any>> };
    for (const t of (parsed.tools ?? [])) {
      if (t && t.name && t.category) toolCategoryMap[String(t.name)] = String(t.category);
    }
  } catch {
    // ignore - manifest optional
  }

  // patch registerTool to wrap handlers with policy checks & auditing
  const orig = (server as any).registerTool.bind(server);

  (server as any).registerTool = function (name: string, config: any, cb: any) {
    // attach category metadata to the tool registration when available
    try {
      config = config || {};
      config._meta = config._meta || {};
      if (!config._meta.category) config._meta.category = toolCategoryMap[name] ?? "uncategorized";
    } catch {
      // ignore metadata attach errors
    }

    const wrapped = async (args: any, extra: any) => {
      const start = Date.now();

      // check CLI / policy
      const allowed = isToolAllowed(name);
      if (!allowed) {
        const err = new Error(`Tool ${name} is disabled by server policy`);
        await auditToolCall(name, args, { ok: false, error: err.message });
        throw err;
      }

      // readonly enforcement: block obvious commit/destructive ops
      const annotations = (config && (config.annotations || {})) || {};
      const destructiveHint = annotations.destructiveHint === true;
      const attemptCommit = args && (args.commit === true || args.autoAdd === true || args.force === true || args.delete === true);
      // In readonly mode we disallow explicit commit/destructive attempts. We no longer block a tool simply
      // because it is marked as destructive; it is allowed to run in readonly mode provided it does not
      // attempt to perform write/commit actions.
      if (runtimeConfig.readonly && attemptCommit) {
        const err = new Error(`Readonly mode prevents tool ${name} from performing commit/destructive actions`);
        await auditToolCall(name, args, { ok: false, error: err.message });
        throw err;
      }

      // Block tools that are annotated as destructive when running in readonly mode unless explicitly allowed
      if (runtimeConfig.readonly && destructiveHint) {
        // If CLI allowedTools is set and includes the tool, permit it; otherwise block
        const cliAllowed = runtimeConfig.allowedTools && runtimeConfig.allowedTools.size > 0 && runtimeConfig.allowedTools.has(name);
        if (!cliAllowed) {
          const err = new Error(`Readonly mode prevents running destructive tool ${name} without explicit allow`);
          await auditToolCall(name, args, { ok: false, error: err.message });
          throw err;
        }
      }

      try {
        const res = await cb(args, extra);
        await auditToolCall(name, args, { ok: true, durationMs: Date.now() - start });
        return res;
      } catch (err) {
        await auditToolCall(name, args, { ok: false, error: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    };

    return orig(name, config, wrapped);
  };
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs";
import path from "node:path";
import { auditToolCall } from "./audit/log.js";
import { runtimeConfig, isToolAllowed } from "./runtimeConfig.js";

export function attachPolicyWrapper(server: McpServer): void {
  // Attempt to load a local manifest to extract per-tool categories and toolset info for _meta
  const toolCategoryMap: Record<string, string> = {};
  const toolIconMap: Record<string, string> = {};
  const toolInsidersMap: Record<string, boolean> = {};
  const toolSafetyMap: Record<string, string> = {};
  const toolToolsetsMap: Record<string, string[]> = {};

  try {
    const p = path.join(process.cwd(), "mcp-tools.json");
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as { tools?: Array<Record<string, any>>; toolsets?: Record<string, string[]> };

    // tool-level metadata
    for (const t of (parsed.tools ?? [])) {
      if (!t || !t.name) continue;
      const name = String(t.name);
      if (t.category) toolCategoryMap[name] = String(t.category);
      if (t.icon) toolIconMap[name] = String(t.icon);
      if (t.insiders) toolInsidersMap[name] = !!t.insiders;
      if (t.safety) toolSafetyMap[name] = String(t.safety);
    }

    // populate toolsets map (toolset -> members) and reverse map (tool -> toolsets)
    if (parsed.toolsets && typeof parsed.toolsets === 'object') {
      runtimeConfig.toolsetsMap = parsed.toolsets as Record<string, string[]>;
      for (const [tsName, members] of Object.entries(parsed.toolsets)) {
        if (!Array.isArray(members)) continue;
        for (const m of members) {
          const mn = String(m);
          if (!toolToolsetsMap[mn]) toolToolsetsMap[mn] = [];
          (toolToolsetsMap[mn] as string[]).push(tsName);
        }
      }
    }

  } catch {
    // ignore - manifest optional
  }

  // patch registerTool to wrap handlers with policy checks & auditing
  const orig = (server as any).registerTool.bind(server);

  (server as any).registerTool = function (name: string, config: any, cb: any) {
    // attach category, icon, insiders, safety, toolset metadata to the tool registration when available
    try {
      config = config || {};
      config._meta = config._meta || {};
      if (!config._meta.category) config._meta.category = toolCategoryMap[name] ?? "uncategorized";
      if (!config._meta.icon && toolIconMap[name]) config._meta.icon = toolIconMap[name];
      if (typeof config._meta.insiders === 'undefined') config._meta.insiders = !!toolInsidersMap[name];
      if (!config._meta.safety && toolSafetyMap[name]) config._meta.safety = toolSafetyMap[name];
      if (!config._meta.toolsets && toolToolsetsMap[name]) config._meta.toolsets = toolToolsetsMap[name];
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

      // lockdown enforcement: prevent network-related tools from running when lockdownMode is enabled
      try {
        const safety = (config && config._meta && config._meta.safety) || "";
        if (runtimeConfig.lockdownMode && safety === "network") {
          const err = new Error(`Lockdown mode prevents running networked tool ${name}`);
          await auditToolCall(name, args, { ok: false, error: err.message });
          throw err;
        }
      } catch (e) {
        // ignore and continue - err will be thrown above if applicable
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

    const registered = orig(name, config, wrapped);

    // If a tool is marked as insiders-only, disable it unless insiders mode is enabled
    try {
      if ((config && config._meta && config._meta.insiders === true) && !runtimeConfig.insiders) {
        if (registered && typeof registered.disable === "function") registered.disable();
      }

      // If running in lockdown mode, also disable tools whose safety is 'network' to avoid exposing external content
      if (runtimeConfig.lockdownMode && (config && config._meta && config._meta.safety === "network")) {
        if (registered && typeof registered.disable === "function") registered.disable();
      }
    } catch {
      // ignore
    }

    return registered;
  };
}

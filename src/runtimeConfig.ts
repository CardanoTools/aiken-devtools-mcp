import fs from "node:fs/promises";
import path from "node:path";

export type PolicySpec = {
  defaultAllow?: boolean;
  allowed?: string[];
  disallowed?: string[];
};

export const runtimeConfig = {
  readonly: true, // default to safe mode
  allowedTools: new Set<string>(), // explicit allowlist from CLI (empty = no CLI restriction)
  allowedToolsets: new Set<string>(), // explicit toolset allowlist (by name)
  toolsetsMap: {} as Record<string, string[]>, // populated from manifest
  dynamicToolsets: false, // allow enabling toolsets at runtime
  insiders: false, // allow experimental/insiders tools
  lockdownMode: false, // restrict content surfaced by tools
  // obey robots.txt by default when ingesting remote content
  obeyRobots: true,
  // cache TTL for robots.txt lookups (ms)
  robotsCacheTtl: 10 * 60_000,
  logFilePath: path.join(process.cwd(), "audit.log"),
  transport: "stdio" as "stdio" | "tcp" | "ws",
  port: undefined as number | undefined,
  authToken: undefined as string | undefined,
  maxFetchSize: 200_000,
  manifestPath: path.join(process.cwd(), "mcp-tools.json"),
  policyPath: path.join(process.cwd(), "mcp-policy.json")
};

export const policy = {
  defaultAllow: true,
  allowed: new Set<string>(),
  disallowed: new Set<string>()
};

export function applyCliOptions(opts: Partial<typeof runtimeConfig>): void {
  if (typeof opts.readonly === "boolean") runtimeConfig.readonly = opts.readonly;
  if (opts.logFilePath) runtimeConfig.logFilePath = opts.logFilePath;
  if (opts.transport) runtimeConfig.transport = opts.transport;
  if (typeof opts.port === "number") runtimeConfig.port = opts.port;
  if (opts.authToken) runtimeConfig.authToken = opts.authToken;
  if (typeof opts.maxFetchSize === "number") runtimeConfig.maxFetchSize = opts.maxFetchSize;
  if (Array.isArray((opts as any).allowedTools)) {
    runtimeConfig.allowedTools = new Set((opts as any).allowedTools as string[]);
  }
  if (Array.isArray((opts as any).toolsets)) {
    runtimeConfig.allowedToolsets = new Set((opts as any).toolsets as string[]);
  }
  if (typeof (opts as any).dynamicToolsets === "boolean") runtimeConfig.dynamicToolsets = (opts as any).dynamicToolsets;
  if (typeof (opts as any).insiders === "boolean") runtimeConfig.insiders = (opts as any).insiders;
  if (typeof (opts as any).lockdownMode === "boolean") runtimeConfig.lockdownMode = (opts as any).lockdownMode;
  if (typeof (opts as any).obeyRobots === "boolean") runtimeConfig.obeyRobots = (opts as any).obeyRobots;
  if (typeof (opts as any).robotsCacheTtl === "number") runtimeConfig.robotsCacheTtl = (opts as any).robotsCacheTtl;
}

export function setAllowedTools(list: string[]): void {
  runtimeConfig.allowedTools = new Set(list);
}

export function setAllowedToolsets(list: string[]): void {
  runtimeConfig.allowedToolsets = new Set(list);
}

export function isToolAllowed(name: string): boolean {
  // CLI allowlist takes precedence when set
  if (runtimeConfig.allowedTools && runtimeConfig.allowedTools.size > 0) {
    return runtimeConfig.allowedTools.has(name);
  }

  // If toolsets are specified, check mapping from toolset -> tool names
  if (runtimeConfig.allowedToolsets && runtimeConfig.allowedToolsets.size > 0 && runtimeConfig.toolsetsMap) {
    for (const ts of runtimeConfig.allowedToolsets) {
      const members = runtimeConfig.toolsetsMap[ts];
      if (Array.isArray(members) && members.includes(name)) return true;
    }
    // not included in specified toolsets
    return false;
  }

  // Policy file driven behavior
  if (policy.allowed.size > 0) return policy.allowed.has(name);
  if (policy.disallowed.size > 0) return !policy.disallowed.has(name);
  return !!policy.defaultAllow;
}

export async function loadPolicyFromFile(): Promise<void> {
  try {
    const raw = await fs.readFile(runtimeConfig.policyPath, "utf8");
    let parsed: PolicySpec = {};
    try {
      parsed = JSON.parse(raw) as PolicySpec;
    } catch {
      // ignore parse errors
      return;
    }

    policy.defaultAllow = parsed.defaultAllow ?? true;

    policy.allowed = new Set(parsed.allowed ?? []);
    policy.disallowed = new Set(parsed.disallowed ?? []);
  } catch {
    // If no policy file present, leave defaults (open by default)
  }
}

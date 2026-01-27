import fs from "node:fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { runGit } from "../git/runGit";
import { KnowledgeSource, KnowledgeSourceSpec } from "../knowledge/types.js";
import { ALL_KNOWLEDGE_SOURCES } from "../knowledge/index.js";
import { getCacheBaseDir, resolveSourceDirPath, resolveRepoBaseDirPath } from "../knowledge/utils.js";

const ALL_SOURCE_IDS = ALL_KNOWLEDGE_SOURCES.map(s => s.id);
if (!ALL_SOURCE_IDS.length) {
  throw new Error("No knowledge sources defined.");
}
// z.enum requires a readonly tuple; assert here to satisfy types
const knowledgeSourceEnum = z.enum(ALL_SOURCE_IDS as unknown as [string, ...string[]]);

// Default: one per unique repo (first source for each folderName)
const DEFAULT_SOURCES: KnowledgeSource[] = Array.from(
  new Map(ALL_KNOWLEDGE_SOURCES.map(s => [s.folderName, s])).values()
).map(s => s.id);

const inputSchema = z
  .object({
    sources: z
      .array(knowledgeSourceEnum)
      .optional()
      .describe(
        "Which knowledge sources to sync. Multiple site-* sources share the same repo. " +
        "Default: [stdlib, prelude, site-fundamentals, evolution-sdk]"
      ),
    ref: z
      .string()
      .optional()
      .describe("Git ref to checkout after syncing (default: each source's defaultRef)."),
    timeoutMs: z.number().int().positive().optional().describe("Timeout in milliseconds (default: 300000).")
  })
  .strict();

const sourceResultSchema = z
  .object({
    source: knowledgeSourceEnum,
    remoteUrl: z.string(),
    path: z.string(),
    subPath: z.string().optional(),
    ref: z.string(),
    description: z.string(),
    ok: z.boolean(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    error: z.string().optional()
  })
  .strict();

const outputSchema = z
  .object({
    cacheDir: z.string(),
    results: z.array(sourceResultSchema)
  })
  .strict();

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function getSourceSpec(source: KnowledgeSource): KnowledgeSourceSpec {
  const spec = ALL_KNOWLEDGE_SOURCES.find(s => s.id === source);
  if (!spec) throw new Error(`Unknown knowledge source: ${source}`);
  return spec;
}

async function syncOne(source: KnowledgeSource, refOverride: string | undefined, timeoutMs?: number) {
  const spec = getSourceSpec(source);
  const cacheDir = getCacheBaseDir();
  const repoBaseDir = resolveRepoBaseDirPath(spec);
  const fullPath = resolveSourceDirPath(spec);

  await fs.mkdir(cacheDir, { recursive: true });

  const desiredRef = (refOverride && refOverride.trim().length ? refOverride.trim() : spec.defaultRef).trim();

  const isRepoDir = await pathExists(repoBaseDir);

  if (!isRepoDir) {
    const clone = await runGit({
      cwd: cacheDir,
      args: ["clone", "--depth", "1", "--branch", desiredRef, spec.remoteUrl, spec.folderName],
      timeoutMs
    });

    if (!clone.ok) {
      return {
        source,
        remoteUrl: spec.remoteUrl,
        path: fullPath,
        subPath: spec.subPath,
        ref: desiredRef,
        description: spec.description,
        ok: false,
        error: clone.error
      };
    }

    if (clone.exitCode !== 0) {
      return {
        source,
        remoteUrl: spec.remoteUrl,
        path: fullPath,
        subPath: spec.subPath,
        ref: desiredRef,
        description: spec.description,
        ok: false,
        stdout: clone.stdout,
        stderr: clone.stderr,
        error: clone.stderr.trim().length ? clone.stderr.trim() : `git clone exited with code ${clone.exitCode}`
      };
    }

    return {
      source,
      remoteUrl: spec.remoteUrl,
      path: fullPath,
      subPath: spec.subPath,
      ref: desiredRef,
      description: spec.description,
      ok: true,
      stdout: clone.stdout,
      stderr: clone.stderr
    };
  }

  // Existing repo: fetch + checkout ref (best-effort).
  const fetch = await runGit({ cwd: repoBaseDir, args: ["fetch", "--all", "--tags", "--prune"], timeoutMs });
  if (!fetch.ok) {
    return {
      source,
      remoteUrl: spec.remoteUrl,
      path: fullPath,
      subPath: spec.subPath,
      ref: desiredRef,
      description: spec.description,
      ok: false,
      error: fetch.error
    };
  }
  if (fetch.exitCode !== 0) {
    return {
      source,
      remoteUrl: spec.remoteUrl,
      path: fullPath,
      subPath: spec.subPath,
      ref: desiredRef,
      description: spec.description,
      ok: false,
      stdout: fetch.stdout,
      stderr: fetch.stderr,
      error: fetch.stderr.trim().length ? fetch.stderr.trim() : `git fetch exited with code ${fetch.exitCode}`
    };
  }

  const checkout = await runGit({ cwd: repoBaseDir, args: ["checkout", desiredRef], timeoutMs });
  if (!checkout.ok) {
    return {
      source,
      remoteUrl: spec.remoteUrl,
      path: fullPath,
      subPath: spec.subPath,
      ref: desiredRef,
      description: spec.description,
      ok: false,
      error: checkout.error
    };
  }
  if (checkout.exitCode !== 0) {
    return {
      source,
      remoteUrl: spec.remoteUrl,
      path: fullPath,
      subPath: spec.subPath,
      ref: desiredRef,
      description: spec.description,
      ok: false,
      stdout: checkout.stdout,
      stderr: checkout.stderr,
      error: checkout.stderr.trim().length ? checkout.stderr.trim() : `git checkout exited with code ${checkout.exitCode}`
    };
  }

  // If ref is a branch, pulling is nice; if not, pull will fail — ignore failures.
  const pull = await runGit({ cwd: repoBaseDir, args: ["pull", "--ff-only"], timeoutMs });
  if (pull.ok && pull.exitCode === 0) {
    return {
      source,
      remoteUrl: spec.remoteUrl,
      path: fullPath,
      subPath: spec.subPath,
      ref: desiredRef,
      description: spec.description,
      ok: true,
      stdout: [fetch.stdout, checkout.stdout, pull.stdout].filter(Boolean).join("\n"),
      stderr: [fetch.stderr, checkout.stderr, pull.stderr].filter(Boolean).join("\n")
    };
  }

  return {
    source,
    remoteUrl: spec.remoteUrl,
    path: fullPath,
    subPath: spec.subPath,
    ref: desiredRef,
    description: spec.description,
    ok: true,
    stdout: [fetch.stdout, checkout.stdout].filter(Boolean).join("\n"),
    stderr: [fetch.stderr, checkout.stderr].filter(Boolean).join("\n")
  };
}

export function registerAikenKnowledgeSyncTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_sync",
    {
      title: "Aiken: knowledge sync",
      description:
        "Clones or updates knowledge sources (stdlib, prelude, site docs, evolution-sdk) into a local cache. " +
        "Multiple site-* sources share the same git repo but point to different documentation sections.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ sources, ref, timeoutMs }) => {
      // Deduplicate sources that share the same folderName (same git repo)
      const selectedSources: KnowledgeSource[] = sources?.length ? (sources as KnowledgeSource[]) : DEFAULT_SOURCES;
      const seenFolders = new Set<string>();
      const toSync: KnowledgeSource[] = [];

      for (const source of selectedSources) {
        const spec = getSourceSpec(source);
        if (!seenFolders.has(spec.folderName)) {
          seenFolders.add(spec.folderName);
          toSync.push(source);
        }
      }

      const results = [] as Array<z.infer<typeof sourceResultSchema>>;
      for (const source of toSync) {
        const r = await syncOne(source, ref, timeoutMs);
        results.push(r);
      }

      const structuredContent: z.infer<typeof outputSchema> = {
        cacheDir: getCacheBaseDir(),
        results
      };

      const okCount = results.filter((r) => r.ok).length;
      const message = okCount === results.length
        ? `Synced ${okCount} knowledge source(s).`
        : `Synced ${okCount}/${results.length} knowledge source(s).`;

      const anyError = results.some((r) => !r.ok);
      if (anyError) {
        return {
          isError: true,
          content: [{ type: "text", text: message }],
          structuredContent
        };
      }

      return {
        content: [{ type: "text", text: message }],
        structuredContent
      };
    }
  );
}

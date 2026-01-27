import fs from "node:fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { runGit } from "../git/runGit";
import {
  KNOWLEDGE_REPOS,
  type KnowledgeRepo,
  resolveCacheDirPath,
  resolveRepoDirPath
} from "../knowledge/knowledgePaths";

const inputSchema = z
  .object({
    repos: z
      .array(z.enum(["stdlib", "prelude", "evolution-sdk"]))
      .optional()
      .describe("Which repos to sync (default: [stdlib, prelude, evolution-sdk])."),
    ref: z
      .string()
      .optional()
      .describe("Git ref to checkout after syncing (default: each repo's defaultRef)."),
    timeoutMs: z.number().int().positive().optional().describe("Timeout in milliseconds (default: 300000).")
  })
  .strict();

const repoResultSchema = z
  .object({
    repo: z.enum(["stdlib", "prelude", "evolution-sdk"]),
    remoteUrl: z.string(),
    path: z.string(),
    ref: z.string(),
    ok: z.boolean(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    error: z.string().optional()
  })
  .strict();

const outputSchema = z
  .object({
    cacheDir: z.string(),
    results: z.array(repoResultSchema)
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

async function syncOne(repo: KnowledgeRepo, refOverride: string | undefined, timeoutMs?: number) {
  const spec = KNOWLEDGE_REPOS[repo];
  const cacheDir = resolveCacheDirPath();
  const repoDir = resolveRepoDirPath(repo);

  await fs.mkdir(cacheDir, { recursive: true });

  const desiredRef = (refOverride && refOverride.trim().length ? refOverride.trim() : spec.defaultRef).trim();

  const isRepoDir = await pathExists(repoDir);

  if (!isRepoDir) {
    const clone = await runGit({
      cwd: cacheDir,
      args: ["clone", "--depth", "1", "--branch", desiredRef, spec.remoteUrl, spec.folderName],
      timeoutMs
    });

    if (!clone.ok) {
      return {
        repo,
        remoteUrl: spec.remoteUrl,
        path: repoDir,
        ref: desiredRef,
        ok: false,
        error: clone.error
      };
    }

    if (clone.exitCode !== 0) {
      return {
        repo,
        remoteUrl: spec.remoteUrl,
        path: repoDir,
        ref: desiredRef,
        ok: false,
        stdout: clone.stdout,
        stderr: clone.stderr,
        error: clone.stderr.trim().length ? clone.stderr.trim() : `git clone exited with code ${clone.exitCode}`
      };
    }

    return {
      repo,
      remoteUrl: spec.remoteUrl,
      path: repoDir,
      ref: desiredRef,
      ok: true,
      stdout: clone.stdout,
      stderr: clone.stderr
    };
  }

  // Existing repo: fetch + checkout ref (best-effort).
  const fetch = await runGit({ cwd: repoDir, args: ["fetch", "--all", "--tags", "--prune"], timeoutMs });
  if (!fetch.ok) {
    return { repo, remoteUrl: spec.remoteUrl, path: repoDir, ref: desiredRef, ok: false, error: fetch.error };
  }
  if (fetch.exitCode !== 0) {
    return {
      repo,
      remoteUrl: spec.remoteUrl,
      path: repoDir,
      ref: desiredRef,
      ok: false,
      stdout: fetch.stdout,
      stderr: fetch.stderr,
      error: fetch.stderr.trim().length ? fetch.stderr.trim() : `git fetch exited with code ${fetch.exitCode}`
    };
  }

  const checkout = await runGit({ cwd: repoDir, args: ["checkout", desiredRef], timeoutMs });
  if (!checkout.ok) {
    return { repo, remoteUrl: spec.remoteUrl, path: repoDir, ref: desiredRef, ok: false, error: checkout.error };
  }
  if (checkout.exitCode !== 0) {
    return {
      repo,
      remoteUrl: spec.remoteUrl,
      path: repoDir,
      ref: desiredRef,
      ok: false,
      stdout: checkout.stdout,
      stderr: checkout.stderr,
      error: checkout.stderr.trim().length ? checkout.stderr.trim() : `git checkout exited with code ${checkout.exitCode}`
    };
  }

  // If ref is a branch, pulling is nice; if not, pull will fail — ignore failures.
  const pull = await runGit({ cwd: repoDir, args: ["pull", "--ff-only"], timeoutMs });
  if (pull.ok && pull.exitCode === 0) {
    return {
      repo,
      remoteUrl: spec.remoteUrl,
      path: repoDir,
      ref: desiredRef,
      ok: true,
      stdout: [fetch.stdout, checkout.stdout, pull.stdout].filter(Boolean).join("\n"),
      stderr: [fetch.stderr, checkout.stderr, pull.stderr].filter(Boolean).join("\n")
    };
  }

  return {
    repo,
    remoteUrl: spec.remoteUrl,
    path: repoDir,
    ref: desiredRef,
    ok: true,
    stdout: [fetch.stdout, checkout.stdout].filter(Boolean).join("\n"),
    stderr: [fetch.stderr, checkout.stderr].filter(Boolean).join("\n")
  };
}

export function registerAikenKnowledgeSyncTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_sync",
    {
      title: "Aiken: knowledge sync (stdlib/prelude)",
      description:
        "Clones or updates aiken-lang/stdlib, aiken-lang/prelude, and IntersectMBO/evolution-sdk into a local cache so agents can search/read them.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: true
      }
    },
    async ({ repos, ref, timeoutMs }) => {
      const selected = (repos?.length ? repos : (["stdlib", "prelude", "evolution-sdk"] as const)).slice();

      const results = [] as Array<z.infer<typeof repoResultSchema>>;
      for (const repo of selected) {
        const r = await syncOne(repo, ref, timeoutMs);
        results.push(r);
      }

      const structuredContent: z.infer<typeof outputSchema> = {
        cacheDir: resolveCacheDirPath(),
        results
      };

      const okCount = results.filter((r) => r.ok).length;
      const message = okCount === results.length ? `Synced ${okCount} repos.` : `Synced ${okCount}/${results.length} repos.`;

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

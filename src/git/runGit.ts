import { spawn } from "node:child_process";
import path from "node:path";
import { checkRateLimit } from "../rateLimit.js";

const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB limit for stdout/stderr

/** Allowed base directories for git operations (workspace root and cache dir) */
const ALLOWED_GIT_BASES = new Set<string>();

/**
 * Register a directory as allowed for git operations.
 * Call this at startup to whitelist workspace and cache directories.
 */
export function registerAllowedGitBase(dirPath: string): void {
  const normalized = path.resolve(dirPath);
  ALLOWED_GIT_BASES.add(normalized);
}

/**
 * Validates that a cwd path is within an allowed base directory.
 * Throws if the path escapes allowed boundaries.
 */
function validateGitCwd(cwd: string): void {
  const resolved = path.resolve(cwd);

  // If no bases are registered, allow all (backward compatibility during setup)
  if (ALLOWED_GIT_BASES.size === 0) {
    return;
  }

  for (const base of ALLOWED_GIT_BASES) {
    if (resolved === base || resolved.startsWith(base + path.sep)) {
      return;
    }
  }

  throw new Error(`Git operation rejected: cwd "${cwd}" is outside allowed directories`);
}

export type RunGitArgs = {
  cwd: string;
  args: string[];
  timeoutMs?: number;
};

export type RunGitResult =
  | {
      ok: true;
      command: string;
      args: string[];
      cwd: string;
      exitCode: number;
      stdout: string;
      stderr: string;
      durationMs: number;
    }
  | {
      ok: false;
      command: string;
      args: string[];
      cwd: string;
      error: string;
    };

export async function runGit(params: RunGitArgs): Promise<RunGitResult> {
  const { cwd, args, timeoutMs = 5 * 60 * 1000 } = params;

  // SECURITY: Rate limiting for git operations (especially clone/fetch)
  const isNetworkOp = args.some((a) => ["clone", "fetch", "pull", "push"].includes(a));
  if (isNetworkOp && !checkRateLimit("git")) {
    return {
      ok: false,
      command: "git",
      args,
      cwd,
      error: "Git rate limit exceeded. Please wait before making more git operations."
    };
  }

  // SECURITY: Validate cwd is within allowed directories
  try {
    validateGitCwd(cwd);
  } catch (err) {
    return {
      ok: false,
      command: "git",
      args,
      cwd,
      error: err instanceof Error ? err.message : String(err)
    };
  }

  const start = Date.now();

  return await new Promise<RunGitResult>((resolve) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({
        ok: false,
        command: "git",
        args,
        cwd,
        error: `git timed out after ${timeoutMs}ms`
      });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_OUTPUT_SIZE) {
        stdout += chunk;
      }
    });

    child.stderr.on("data", (chunk) => {
      if (stderr.length < MAX_OUTPUT_SIZE) {
        stderr += chunk;
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeout);

      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({
          ok: false,
          command: "git",
          args,
          cwd,
          error: "`git` was not found on PATH. Install git and try again."
        });
        return;
      }

      resolve({
        ok: false,
        command: "git",
        args,
        cwd,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      resolve({
        ok: true,
        command: "git",
        args,
        cwd,
        exitCode: code ?? 0,
        stdout,
        stderr,
        durationMs: Date.now() - start
      });
    });
  });
}

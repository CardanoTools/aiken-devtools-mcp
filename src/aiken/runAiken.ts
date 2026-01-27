import { spawn } from "node:child_process";
import path from "node:path";

export type RunAikenArgs = {
  cwd: string;
  args: string[];
  timeoutMs?: number;
};

export type RunAikenResult =
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

export function resolveWorkspacePath(workspaceRoot: string, relativeOrAbsolutePath?: string): string {
  if (!relativeOrAbsolutePath) return workspaceRoot;

  const resolved = path.resolve(workspaceRoot, relativeOrAbsolutePath);
  const normalizedRoot = path.resolve(workspaceRoot) + path.sep;

  if (!resolved.startsWith(normalizedRoot) && resolved !== path.resolve(workspaceRoot)) {
    throw new Error(`Path must be within workspace root: ${relativeOrAbsolutePath}`);
  }

  return resolved;
}

export async function runAiken(params: RunAikenArgs): Promise<RunAikenResult> {
  const { cwd, args, timeoutMs = 5 * 60 * 1000 } = params;

  const start = Date.now();

  return await new Promise<RunAikenResult>((resolve) => {
    const child = spawn("aiken", args, {
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
        command: "aiken",
        args,
        cwd,
        error: `aiken timed out after ${timeoutMs}ms`
      });
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timeout);

      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        resolve({
          ok: false,
          command: "aiken",
          args,
          cwd,
          error: "`aiken` was not found on PATH. Install Aiken (https://github.com/aiken-lang/aiken) and try again."
        });
        return;
      }

      resolve({
        ok: false,
        command: "aiken",
        args,
        cwd,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      resolve({
        ok: true,
        command: "aiken",
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

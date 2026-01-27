import { spawn } from "node:child_process";

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

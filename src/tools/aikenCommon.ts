import type { RunAikenResult } from "../aiken/runAiken";

export type AikenCliStructuredOutput = {
  command: "aiken";
  args: string[];
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export function toAikenToolResult(result: RunAikenResult):
  | { isError: true; content: Array<{ type: "text"; text: string }> }
  | { isError?: false; content: Array<{ type: "text"; text: string }>; structuredContent: AikenCliStructuredOutput }
  | {
      isError: true;
      content: Array<{ type: "text"; text: string }>;
      structuredContent: AikenCliStructuredOutput;
    } {
  if (!result.ok) {
    return {
      isError: true,
      content: [{ type: "text", text: result.error }]
    };
  }

  const stdoutTrimmed = result.stdout.trim();
  const stderrTrimmed = result.stderr.trim();

  const structuredContent: AikenCliStructuredOutput = {
    command: "aiken",
    args: result.args,
    cwd: result.cwd,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs
  };

  if (result.exitCode !== 0) {
    const message = stderrTrimmed.length
      ? stderrTrimmed
      : stdoutTrimmed.length
        ? stdoutTrimmed
        : `aiken exited with code ${result.exitCode}`;

    return {
      isError: true,
      content: [{ type: "text", text: message }],
      structuredContent
    };
  }

  return {
    content: [{ type: "text", text: stdoutTrimmed.length ? stdoutTrimmed : "ok" }],
    structuredContent
  };
}

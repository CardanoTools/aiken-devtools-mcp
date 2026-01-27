import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath, runAiken } from "../aiken/runAiken";
import { toAikenToolResult } from "./aikenCommon";

const inputSchema = z
  .object({
    projectDir: z
      .string()
      .optional()
      .describe("Project directory (relative to the current workspace). Defaults to workspace root."),
    checkOnly: z
      .boolean()
      .optional()
      .describe("If true, runs formatter in check mode when supported (passes `--check`)."),
    extraArgs: z
      .array(z.string())
      .optional()
      .describe("Additional args passed to `aiken fmt` (advanced)."),
    timeoutMs: z.number().int().positive().optional().describe("Timeout in milliseconds (default: 300000).")
  })
  .strict();

const outputSchema = z
  .object({
    command: z.literal("aiken"),
    args: z.array(z.string()),
    cwd: z.string(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
    durationMs: z.number()
  })
  .strict();

export function registerAikenFmtTool(server: McpServer): void {
  server.registerTool(
    "aiken_fmt",
    {
      title: "Aiken: fmt",
      description: "Runs `aiken fmt` to format Aiken sources.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, checkOnly, extraArgs, timeoutMs }) => {
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);

      const args = ["fmt", ...(checkOnly ? ["--check"] : []), ...(extraArgs ?? [])];

      const result = await runAiken({ cwd, args, timeoutMs });
      return toAikenToolResult(result);
    }
  );
}

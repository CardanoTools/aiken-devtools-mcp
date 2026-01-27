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
    extraArgs: z
      .array(z.string())
      .optional()
      .describe("Additional args passed to `aiken build` (advanced)."),
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

export function registerAikenBuildTool(server: McpServer): void {
  server.registerTool(
    "aiken_build",
    {
      title: "Aiken: build",
      description: "Runs `aiken build` to compile the project and produce artifacts.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        // Build writes artifacts in the project directory.
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, extraArgs, timeoutMs }) => {
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);
      const args = ["build", ...(extraArgs ?? [])];

      const result = await runAiken({ cwd, args, timeoutMs });
      return toAikenToolResult(result);
    }
  );
}

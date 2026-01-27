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
      .describe("Additional args passed to `aiken docs` (advanced)."),
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

export function registerAikenDocsTool(server: McpServer): void {
  server.registerTool(
    "aiken_docs",
    {
      title: "Aiken: docs",
      description: "Runs `aiken docs` to generate project documentation.",
      inputSchema,
      outputSchema,
      annotations: {
        // `aiken docs` typically writes generated docs.
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, extraArgs, timeoutMs }) => {
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);
      const args = ["docs", ...(extraArgs ?? [])];

      const result = await runAiken({ cwd, args, timeoutMs });
      return toAikenToolResult(result);
    }
  );
}

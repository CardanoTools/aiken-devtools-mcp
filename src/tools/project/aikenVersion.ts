import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath, runAiken } from "../../aiken/runAiken.js";
import { toAikenToolResult } from "../common/aikenCommon.js";

const inputSchema = z
  .object({
    projectDir: z
      .string()
      .optional()
      .describe("Project directory (relative to the current workspace). Defaults to workspace root.")
  })
  .strict() as z.ZodTypeAny;

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
  .strict() as z.ZodTypeAny;

export function registerAikenVersionTool(server: McpServer): void {
  server.registerTool(
    "aiken_version",
    {
      title: "Aiken: version",
      description: "Returns the installed Aiken CLI version.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async (input: { projectDir?: string }) => {
      const { projectDir } = input;
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);
      const result = await runAiken({ cwd, args: ["--version"], timeoutMs: 20_000 });

      return toAikenToolResult(result);
    }
  );
}

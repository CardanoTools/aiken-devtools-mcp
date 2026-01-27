import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath, runAiken } from "../aiken/runAiken";
import { toAikenToolResult } from "./aikenCommon";

const inputSchema = z
  .object({
    name: z.string().describe("Name of the new project."),
    projectDir: z
      .string()
      .optional()
      .describe("Directory where to create the project (relative to the current workspace). Defaults to workspace root."),
    template: z
      .string()
      .optional()
      .describe("Template to use for the project (e.g., 'starter')."),
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

export function registerAikenNewTool(server: McpServer): void {
  server.registerTool(
    "aiken_new",
    {
      title: "Aiken: new",
      description: "Creates a new Aiken project with `aiken new`.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
        openWorldHint: false
      }
    },
    async ({ name, projectDir, template, timeoutMs }) => {
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);

      const args = ["new", name];
      if (template) {
        args.push("--template", template);
      }

      const result = await runAiken({ cwd, args, timeoutMs });
      return toAikenToolResult(result);
    }
  );
}

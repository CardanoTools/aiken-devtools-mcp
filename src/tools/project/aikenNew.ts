import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath, runAiken } from "../../aiken/runAiken.js";
import { toAikenToolResult } from "../common/aikenCommon.js";

// Validate project name to prevent path traversal and command injection
const safeProjectName = z.string()
  .min(1, "Project name is required")
  .max(100, "Project name must be 100 characters or less")
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, "Project name must start with a letter and contain only alphanumeric characters, hyphens, and underscores")
  .refine(
    (name) => !name.includes("..") && !name.includes("/") && !name.includes("\\"),
    "Project name cannot contain path separators or parent directory references"
  );

const inputSchema = z
  .object({
    name: safeProjectName.describe("Name of the new project (must start with a letter, alphanumeric with hyphens/underscores)."),
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

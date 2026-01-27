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
    blueprintPath: z
      .string()
      .optional()
      .describe("Optional path to the blueprint file (relative to projectDir). Defaults to plutus.json."),
    module: z
      .string()
      .optional()
      .describe("Name of the validator's module within the project. Optional if there's only one validator."),
    validator: z
      .string()
      .optional()
      .describe("Name of the validator within the module. Optional if there's only one validator."),
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

export function registerAikenBlueprintHashTool(server: McpServer): void {
  server.registerTool(
    "aiken_blueprint_hash",
    {
      title: "Aiken: blueprint hash",
      description:
        "Runs `aiken blueprint hash` to compute a validator's payment credential hash (hex). Requires a built blueprint (default: plutus.json).",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, blueprintPath, module, validator, timeoutMs }) => {
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);

      const args: string[] = ["blueprint", "hash"];
      if (blueprintPath) args.push("--in", blueprintPath);
      if (module) args.push("--module", module);
      if (validator) args.push("--validator", validator);

      const result = await runAiken({ cwd, args, timeoutMs });
      return toAikenToolResult(result);
    }
  );
}

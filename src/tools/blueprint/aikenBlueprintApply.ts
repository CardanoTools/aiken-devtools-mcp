import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath, runAiken } from "../../aiken/runAiken.js";
import { toAikenToolResult } from "../common/aikenCommon.js";

// Validate hex string to ensure it's valid CBOR hex input
const validHexString = z.string()
  .min(1, "CBOR hex is required")
  .regex(/^[0-9a-fA-F]*$/, "Must be a valid hexadecimal string")
  .refine(
    (hex) => hex.length % 2 === 0,
    "Hex string must have even length (each byte is 2 hex characters)"
  );

const inputSchema = z
  .object({
    projectDir: z
      .string()
      .optional()
      .describe("Project directory (relative to the current workspace). Defaults to workspace root."),
    parameterCborHex: validHexString
      .describe(
        "The parameter as Plutus Data encoded in CBOR, hex-encoded (required; this tool is non-interactive)."
      ),
    blueprintPath: z
      .string()
      .optional()
      .describe("Optional path to the blueprint file (relative to projectDir). Defaults to plutus.json."),
    outputPath: z
      .string()
      .optional()
      .describe(
        "Optional output blueprint filepath (relative to projectDir). If omitted, Aiken prints the updated blueprint JSON to stdout (can be large)."
      ),
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

export function registerAikenBlueprintApplyTool(server: McpServer): void {
  server.registerTool(
    "aiken_blueprint_apply",
    {
      title: "Aiken: blueprint apply",
      description:
        "Runs `aiken blueprint apply` to apply one parameter to a parameterized validator in the blueprint (non-interactive; requires parameter CBOR hex).",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        // Applies a parameter and may write a new blueprint if outputPath is set.
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, parameterCborHex, blueprintPath, outputPath, module, validator, timeoutMs }) => {
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);

      const args: string[] = ["blueprint", "apply", parameterCborHex];
      if (blueprintPath) args.push("--in", blueprintPath);
      if (outputPath) args.push("--out", outputPath);
      if (module) args.push("--module", module);
      if (validator) args.push("--validator", validator);

      const result = await runAiken({ cwd, args, timeoutMs });
      return toAikenToolResult(result);
    }
  );
}

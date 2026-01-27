import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath, runAiken } from "../aiken/runAiken";

const inputSchema = z
  .object({
    projectDir: z
      .string()
      .optional()
      .describe(
        "Project directory (relative to the current workspace). The command reads plutus.json from this directory. Defaults to workspace root."
      ),
    module: z
      .string()
      .optional()
      .describe("Name of the validator's module within the project. Optional if there's only one validator."),
    validator: z
      .string()
      .optional()
      .describe("Name of the validator within the module. Optional if there's only one validator."),
    outputPath: z
      .string()
      .optional()
      .describe(
        "If provided, writes the converted cardano-cli JSON to this path (relative to projectDir). If omitted, returns it in structured output only."
      ),
    pretty: z
      .boolean()
      .optional()
      .describe("Pretty-print JSON when writing outputPath (default: true)."),
    timeoutMs: z.number().int().positive().optional().describe("Timeout in milliseconds (default: 300000).")
  })
  .strict();

const commandResultSchema = z
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

const cardanoCliScriptSchema = z
  .object({
    type: z.string(),
    description: z.string().optional(),
    cborHex: z.string()
  })
  .passthrough();

const outputSchema = z
  .object({
    commandResult: commandResultSchema,
    format: z.literal("cardano-cli"),
    script: cardanoCliScriptSchema,
    writtenFile: z.string().optional()
  })
  .strict();

export function registerAikenBlueprintExportCardanoCliTool(server: McpServer): void {
  server.registerTool(
    "aiken_blueprint_export_cardano_cli",
    {
      title: "Aiken: blueprint export (cardano-cli)",
      description:
        "Runs `aiken blueprint convert --to cardano-cli` and returns parsed JSON (and optionally writes it to a file).",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, module, validator, outputPath, pretty, timeoutMs }) => {
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);

      const args: string[] = ["blueprint", "convert"];
      if (module) args.push("--module", module);
      if (validator) args.push("--validator", validator);
      args.push("--to", "cardano-cli");

      const result = await runAiken({ cwd, args, timeoutMs });

      if (!result.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: result.error }]
        };
      }

      const commandResult: z.infer<typeof commandResultSchema> = {
        command: "aiken",
        args: result.args,
        cwd: result.cwd,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs
      };

      if (result.exitCode !== 0) {
        return {
          isError: true,
          content: [{ type: "text", text: result.stderr || "aiken blueprint convert failed." }],
          structuredContent: {
            commandResult,
            format: "cardano-cli",
            script: { type: "unknown", cborHex: "" }
          }
        };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to parse JSON from aiken output: ${message}` }],
          structuredContent: {
            commandResult,
            format: "cardano-cli",
            script: { type: "unknown", cborHex: "" }
          }
        };
      }

      const script = cardanoCliScriptSchema.safeParse(parsed);
      if (!script.success) {
        return {
          isError: true,
          content: [{ type: "text", text: "Unexpected cardano-cli JSON shape from aiken." }],
          structuredContent: {
            commandResult,
            format: "cardano-cli",
            script: { type: "unknown", cborHex: "" }
          }
        };
      }

      let writtenFile: string | undefined;
      if (outputPath) {
        const absOut = resolveWorkspacePath(cwd, outputPath);
        await fs.mkdir(path.dirname(absOut), { recursive: true });
        const json = JSON.stringify(script.data, null, pretty === false ? 0 : 2) + "\n";
        await fs.writeFile(absOut, json, "utf8");
        writtenFile = absOut;
      }

      const structuredContent: z.infer<typeof outputSchema> = {
        commandResult,
        format: "cardano-cli",
        script: script.data,
        ...(writtenFile ? { writtenFile } : {})
      };

      return {
        content: [{ type: "text", text: writtenFile ? "Exported cardano-cli JSON." : "Converted to cardano-cli JSON." }],
        structuredContent
      };
    }
  );
}

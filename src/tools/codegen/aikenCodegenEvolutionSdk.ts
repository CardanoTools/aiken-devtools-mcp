import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath, runAiken } from "../../aiken/runAiken.js";

import { cardanoCliScriptSchema, mapCardanoCliTypeToPlutusVersion, toIdentifier } from "../../codegen/cardanoCli.js";
import { generateEvolutionSdkSnippet } from "../../codegen/snippets.js";

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

    networkId: z
      .number()
      .int()
      .min(0)
      .max(15)
      .optional()
      .describe("Cardano network id (default: 0 for testnets/devnets; 1 for mainnet)."),

    exportName: z
      .string()
      .optional()
      .describe("Identifier prefix used in generated code (default: derived from validator or 'script')."),

    includeAddressAndHashes: z
      .boolean()
      .optional()
      .describe(
        "If true, include helpers to compute ScriptHash (policyId) and a script address using Evolution SDK types."
      ),

    outputPath: z
      .string()
      .optional()
      .describe(
        "If provided, writes the generated TypeScript snippet to this path (relative to projectDir). If omitted, returns it in structured output only."
      ),

    timeoutMs: z.number().int().positive().optional().describe("Timeout in milliseconds (default: 300000).")
  })
  .strict();

const outputSchema = z
  .object({
    format: z.literal("evolution-sdk"),
    cborHex: z.string(),
    plutusVersion: z.enum(["PlutusV1", "PlutusV2", "PlutusV3"]).optional(),
    cardanoCliScript: cardanoCliScriptSchema,
    snippetTs: z.string(),
    writtenFile: z.string().optional()
  })
  .strict();

export function registerAikenCodegenEvolutionSdkTool(server: McpServer): void {
  server.registerTool(
    "aiken_codegen_evolution_sdk",
    {
      title: "Aiken: codegen (Evolution SDK)",
      description:
        "Generates a TypeScript snippet using IntersectMBO/evolution-sdk packages by converting an Aiken validator to CBOR hex and constructing a Plutus script + hashes/address.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, module, validator, networkId, exportName, includeAddressAndHashes, outputPath, timeoutMs }) => {
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);

      const args: string[] = ["blueprint", "convert"];
      if (module) args.push("--module", module);
      if (validator) args.push("--validator", validator);
      args.push("--to", "cardano-cli");

      const result = await runAiken({ cwd, args, timeoutMs });
      if (!result.ok) {
        return { isError: true, content: [{ type: "text", text: (result as { ok: false; error: string }).error }] };
      }
      if (result.exitCode !== 0) {
        const message = result.stderr.trim() || result.stdout.trim() || `aiken exited with code ${result.exitCode}`;
        return { isError: true, content: [{ type: "text", text: message }] };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to parse JSON from aiken output: ${message}` }]
        };
      }

      const cardanoCliScript = cardanoCliScriptSchema.safeParse(parsed);
      if (!cardanoCliScript.success) {
        return { isError: true, content: [{ type: "text", text: "Unexpected cardano-cli JSON shape from aiken." }] };
      }

      const cborHex = cardanoCliScript.data.cborHex;
      const plutusVersion = mapCardanoCliTypeToPlutusVersion(String(cardanoCliScript.data.type));

      const baseName = exportName ?? toIdentifier(validator ?? "script", { fallback: "script", prefixIfStartsDigit: "s_" });
      const netId = networkId ?? 0;
      const includeHelpers = includeAddressAndHashes ?? true;

      const snippetTs = generateEvolutionSdkSnippet({
        cborHex,
        plutusVersion,
        exportName: baseName,
        networkId: netId,
        includeAddressAndHashes: includeHelpers
      });

      let writtenFile: string | undefined;
      if (outputPath) {
        const absOut = resolveWorkspacePath(cwd, outputPath);
        await fs.mkdir(path.dirname(absOut), { recursive: true });
        await fs.writeFile(absOut, snippetTs, "utf8");
        writtenFile = absOut;
      }

      const structuredContent: z.infer<typeof outputSchema> = {
        format: "evolution-sdk",
        cborHex,
        ...(plutusVersion ? { plutusVersion } : {}),
        cardanoCliScript: cardanoCliScript.data,
        snippetTs,
        ...(writtenFile ? { writtenFile } : {})
      };

      return {
        content: [{ type: "text", text: writtenFile ? "Generated Evolution SDK snippet (written to file)." : "Generated Evolution SDK snippet." }],
        structuredContent
      };
    }
  );
}

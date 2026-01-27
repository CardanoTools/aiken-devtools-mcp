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

const cardanoCliScriptSchema = z
  .object({
    type: z.string(),
    description: z.string().optional(),
    cborHex: z.string()
  })
  .passthrough();

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

function toIdentifier(input: string): string {
  const cleaned = input
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");

  if (!cleaned.length) return "script";
  if (/^[0-9]/.test(cleaned)) return `s_${cleaned}`;
  return cleaned;
}

function mapCardanoCliTypeToPlutusVersion(type: string): "PlutusV1" | "PlutusV2" | "PlutusV3" | undefined {
  const t = type.toLowerCase();
  if (t.includes("v1")) return "PlutusV1";
  if (t.includes("v2")) return "PlutusV2";
  if (t.includes("v3")) return "PlutusV3";
  return undefined;
}

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
        return { isError: true, content: [{ type: "text", text: result.error }] };
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

      const baseName = exportName ?? toIdentifier(validator ?? "script");
      const netId = networkId ?? 0;
      const includeHelpers = includeAddressAndHashes ?? true;

      const plutusModule = plutusVersion ?? "PlutusV2";
      const snippetTs =
        `// Generated by aiken-devtools-mcp (tool: aiken_codegen_evolution_sdk)\n` +
        `// Source repo: https://github.com/IntersectMBO/evolution-sdk\n\n` +
        `import { Schema } from \"effect\";\n` +
        `import * as Address from \"@evolution-sdk/evolution/Address\";\n` +
        `import * as Bytes from \"@evolution-sdk/evolution/Bytes\";\n` +
        `import * as ScriptHash from \"@evolution-sdk/evolution/ScriptHash\";\n` +
        `import * as PlutusV1 from \"@evolution-sdk/evolution/PlutusV1\";\n` +
        `import * as PlutusV2 from \"@evolution-sdk/evolution/PlutusV2\";\n` +
        `import * as PlutusV3 from \"@evolution-sdk/evolution/PlutusV3\";\n\n` +
        `export const ${baseName}CborHex = \"${cborHex}\";\n` +
        `export const ${baseName}Script = new ${plutusModule}.${plutusModule}({ bytes: Bytes.fromHex(${baseName}CborHex) });\n` +
        (includeHelpers
          ? `\nexport const ${baseName}ScriptHash = ScriptHash.fromScript(${baseName}Script);\n` +
            `export const ${baseName}PolicyIdHex = ScriptHash.toHex(${baseName}ScriptHash);\n` +
            `\n// Enterprise address (no staking credential)\n` +
            `export const ${baseName}AddressStruct = new Address.Address({\n` +
            `  networkId: ${netId},\n` +
            `  paymentCredential: ${baseName}ScriptHash,\n` +
            `  stakingCredential: undefined\n` +
            `});\n` +
            `export const ${baseName}AddressBech32 = Schema.encodeSync(Address.FromBech32)(${baseName}AddressStruct);\n`
          : "");

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

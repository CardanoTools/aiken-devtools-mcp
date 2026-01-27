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

    kind: z
      .enum(["spending", "minting"])
      .optional()
      .describe("Whether to generate a spending validator snippet or a minting policy snippet (default: spending)."),

    exportName: z
      .string()
      .optional()
      .describe("Identifier to use in the generated code (default: derived from validator or 'validator')."),

    includeAddressOrPolicyId: z
      .boolean()
      .optional()
      .describe(
        "If true, includes helper code to derive address (spending) or policyId (minting) using Lucid utilities."
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
    format: z.literal("lucid-evolution"),
    kind: z.enum(["spending", "minting"]),
    plutusVersion: z.enum(["PlutusV1", "PlutusV2", "PlutusV3"]).optional(),
    cborHex: z.string(),
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

  if (!cleaned.length) return "validator";
  if (/^[0-9]/.test(cleaned)) return `v_${cleaned}`;
  return cleaned;
}

function mapCardanoCliTypeToLucidPlutus(type: string): "PlutusV1" | "PlutusV2" | "PlutusV3" | undefined {
  const t = type.toLowerCase();
  if (t.includes("v1")) return "PlutusV1";
  if (t.includes("v2")) return "PlutusV2";
  if (t.includes("v3")) return "PlutusV3";
  return undefined;
}

export function registerAikenCodegenLucidEvolutionTool(server: McpServer): void {
  server.registerTool(
    "aiken_codegen_lucid_evolution",
    {
      title: "Aiken: codegen (@lucid-evolution/lucid)",
      description:
        "Generates a ready-to-paste TypeScript snippet for @lucid-evolution/lucid by converting an Aiken validator to cardano-cli JSON and mapping it to a Lucid script object.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, module, validator, kind, exportName, includeAddressOrPolicyId, outputPath, timeoutMs }) => {
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
      const plutusVersion = mapCardanoCliTypeToLucidPlutus(String(cardanoCliScript.data.type));

      const chosenKind = kind ?? "spending";
      const baseName = exportName ?? toIdentifier(validator ?? (chosenKind === "minting" ? "policy" : "validator"));

      const importTypes = chosenKind === "minting" ? "MintingPolicy" : "SpendingValidator";
      const asType = chosenKind === "minting" ? "MintingPolicy" : "SpendingValidator";

      const includeDerivation = includeAddressOrPolicyId ?? true;
      const derivationLine =
        chosenKind === "minting"
          ? `export const ${baseName}Id = lucid.utils.mintingPolicyToId(${baseName});`
          : `export const ${baseName}Address = lucid.utils.validatorToAddress(${baseName});`;

      const snippetTs =
        `// Generated by aiken-devtools-mcp (tool: aiken_codegen_lucid_evolution)\n` +
        `// Package: @lucid-evolution/lucid\n\n` +
        `import type { ${importTypes} } from "@lucid-evolution/lucid";\n` +
        `// Ensure you have a Lucid instance available as \"lucid\" if you use the helpers below.\n\n` +
        `export const ${baseName}: ${asType} = {\n` +
        `  type: ${plutusVersion ? `"${plutusVersion}"` : "\"PlutusV2\""},\n` +
        `  script: "${cborHex}",\n` +
        `};\n\n` +
        (includeDerivation ? derivationLine + "\n" : "");

      let writtenFile: string | undefined;
      if (outputPath) {
        const absOut = resolveWorkspacePath(cwd, outputPath);
        await fs.mkdir(path.dirname(absOut), { recursive: true });
        await fs.writeFile(absOut, snippetTs, "utf8");
        writtenFile = absOut;
      }

      const structuredContent: z.infer<typeof outputSchema> = {
        format: "lucid-evolution",
        kind: chosenKind,
        ...(plutusVersion ? { plutusVersion } : {}),
        cborHex,
        cardanoCliScript: cardanoCliScript.data,
        snippetTs,
        ...(writtenFile ? { writtenFile } : {})
      };

      return {
        content: [{ type: "text", text: writtenFile ? "Generated Lucid Evolution snippet (written to file)." : "Generated Lucid Evolution snippet." }],
        structuredContent
      };
    }
  );
}

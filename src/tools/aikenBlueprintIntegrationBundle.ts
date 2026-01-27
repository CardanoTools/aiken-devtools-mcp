import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath, runAiken, type RunAikenResult } from "../aiken/runAiken";
import { cardanoCliScriptSchema, mapCardanoCliTypeToPlutusVersion, toIdentifier } from "../codegen/cardanoCli";
import { generateEvolutionSdkSnippet, generateLucidEvolutionSnippet } from "../codegen/snippets";

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

    delegatedTo: z.string().optional().describe("Optional stake address to attach (for address output)."),
    mainnet: z.boolean().optional().describe("Output mainnet address (defaults to testnet)."),

    includeCardanoCliScript: z
      .boolean()
      .optional()
      .describe("Also run `aiken blueprint convert --to cardano-cli` and parse its JSON output."),
    includeEvolutionSdkSnippet: z
      .boolean()
      .optional()
      .describe("If true, generate an Evolution SDK snippet (preferred). Implies cardano-cli conversion."),
    evolutionOutputPath: z
      .string()
      .optional()
      .describe(
        "If provided, writes the Evolution SDK snippet to this file path (relative to projectDir). Requires includeEvolutionSdkSnippet."
      ),
    evolutionNetworkId: z
      .number()
      .int()
      .min(0)
      .max(15)
      .optional()
      .describe("Cardano network id for Evolution SDK snippet (default: 0)."),
    evolutionExportName: z
      .string()
      .optional()
      .describe("Identifier prefix used in Evolution SDK snippet (default: derived from validator or 'script')."),
    evolutionIncludeAddressAndHashes: z
      .boolean()
      .optional()
      .describe("If true, include helpers for script hash/policyId/address in Evolution SDK snippet."),
    includeLucidSnippet: z
      .boolean()
      .optional()
      .describe("If true, generate a @lucid-evolution/lucid snippet. Implies cardano-cli conversion."),
    lucidOutputPath: z
      .string()
      .optional()
      .describe(
        "If provided, writes the Lucid snippet to this file path (relative to projectDir). Requires includeLucidSnippet."
      ),
    lucidKind: z
      .enum(["spending", "minting"])
      .optional()
      .describe("Lucid snippet kind (default: spending)."),
    lucidExportName: z
      .string()
      .optional()
      .describe("Identifier used in Lucid snippet (default: derived from validator or 'validator/policy')."),
    lucidIncludeAddressOrPolicyId: z
      .boolean()
      .optional()
      .describe("If true, include address/policyId helpers in Lucid snippet."),
    scriptOutputPath: z
      .string()
      .optional()
      .describe(
        "If includeCardanoCliScript is true, optionally write the cardano-cli JSON to this file path (relative to projectDir)."
      ),
    pretty: z
      .boolean()
      .optional()
      .describe("Pretty-print JSON when writing scriptOutputPath (default: true)."),

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

const stepSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      commandResult: commandResultSchema
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z.string(),
      command: z.literal("aiken"),
      args: z.array(z.string()),
      cwd: z.string(),
      commandResult: commandResultSchema.optional()
    })
    .strict()
]);

export const integrationBundleOutputSchema = z
  .object({
    cwd: z.string(),
    selector: z
      .object({
        module: z.string().optional(),
        validator: z.string().optional()
      })
      .strict(),

    hash: z.string().optional(),
    address: z.string().optional(),
    policyId: z.string().optional(),

    cardanoCliScript: cardanoCliScriptSchema.optional(),
    writtenScriptFile: z.string().optional(),
    evolutionSdkSnippetTs: z.string().optional(),
    lucidEvolutionSnippetTs: z.string().optional(),
    writtenEvolutionSnippetFile: z.string().optional(),
    writtenLucidSnippetFile: z.string().optional(),

    steps: z
      .object({
        hash: stepSchema,
        address: stepSchema,
        policy: stepSchema,
        convert: stepSchema.optional()
      })
      .strict()
  })
  .strict();

function normalizeStep(result: RunAikenResult): z.infer<typeof stepSchema> {
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      command: "aiken",
      args: result.args,
      cwd: result.cwd
    };
  }


type IntegrationBundleStructuredContent = z.infer<typeof integrationBundleOutputSchema>;
type IntegrationBundleInput = {
  workspaceRoot: string;
  projectDir?: string;
  blueprintPath?: string;
  module?: string;
  validator?: string;
  delegatedTo?: string;
  mainnet?: boolean;
  includeCardanoCliScript?: boolean;
  includeEvolutionSdkSnippet?: boolean;
  evolutionOutputPath?: string;
  evolutionNetworkId?: number;
  evolutionExportName?: string;
  evolutionIncludeAddressAndHashes?: boolean;
  includeLucidSnippet?: boolean;
  lucidOutputPath?: string;
  lucidKind?: "spending" | "minting";
  lucidExportName?: string;
  lucidIncludeAddressOrPolicyId?: boolean;
  scriptOutputPath?: string;
  pretty?: boolean;
  timeoutMs?: number;
};
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
    const stdoutTrimmed = result.stdout.trim();
    const stderrTrimmed = result.stderr.trim();
    const message = stderrTrimmed.length
      ? stderrTrimmed
      : stdoutTrimmed.length
        ? stdoutTrimmed
        : `aiken exited with code ${result.exitCode}`;

    return {
      ok: false,
      error: message,
      command: "aiken",
      args: result.args,
      cwd: result.cwd,
      commandResult
    };
  }

  return { ok: true, commandResult };
}

export function registerAikenBlueprintIntegrationBundleTool(server: McpServer): void {
  server.registerTool(
    "aiken_blueprint_integration_bundle",
    {
      title: "Aiken: blueprint integration bundle",
      description:
        "Computes integration-critical outputs from an Aiken blueprint: hash, address, policy ID (and optionally cardano-cli script JSON) in one call.",
      inputSchema,
      outputSchema: integrationBundleOutputSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({
      projectDir,
      blueprintPath,
      module,
      validator,
      delegatedTo,
      mainnet,
      includeCardanoCliScript,
      includeEvolutionSdkSnippet,
      evolutionOutputPath,
      evolutionNetworkId,
      evolutionExportName,
      evolutionIncludeAddressAndHashes,
      includeLucidSnippet,
      lucidOutputPath,
      lucidKind,
      lucidExportName,
      lucidIncludeAddressOrPolicyId,
      scriptOutputPath,
      pretty,
      timeoutMs
    }) => {
      const { structuredContent, errors } = await computeIntegrationBundle({
        workspaceRoot: process.cwd(),
        projectDir,
        blueprintPath,
        module,
        validator,
        delegatedTo,
        mainnet,
        includeCardanoCliScript,
        includeEvolutionSdkSnippet,
        evolutionOutputPath,
        evolutionNetworkId,
        evolutionExportName,
        evolutionIncludeAddressAndHashes,
        includeLucidSnippet,
        lucidOutputPath,
        lucidKind,
        lucidExportName,
        lucidIncludeAddressOrPolicyId,
        scriptOutputPath,
        pretty,
        timeoutMs
      });

      if (errors.length) {
        return {
          isError: true,
          content: [{ type: "text", text: errors.join("\n") }],
          structuredContent
        };
      }

      return {
        content: [{ type: "text", text: "Computed blueprint integration bundle." }],
        structuredContent
      };
    }
  );
}

export async function computeIntegrationBundle(
  params: IntegrationBundleInput
): Promise<{ structuredContent: IntegrationBundleStructuredContent; errors: string[] }> {
  const cwd = resolveWorkspacePath(params.workspaceRoot, params.projectDir);

  const commonFlags: string[] = [];
  if (params.blueprintPath) commonFlags.push("--in", params.blueprintPath);
  if (params.module) commonFlags.push("--module", params.module);
  if (params.validator) commonFlags.push("--validator", params.validator);

  const hashArgs = ["blueprint", "hash", ...commonFlags];
  const addressArgs = [
    "blueprint",
    "address",
    ...commonFlags,
    ...(params.delegatedTo ? ["--delegated-to", params.delegatedTo] : []),
    ...(params.mainnet ? ["--mainnet"] : [])
  ];
  const policyArgs = ["blueprint", "policy", ...commonFlags];

  const hashRes = await runAiken({ cwd, args: hashArgs, timeoutMs: params.timeoutMs });
  const addrRes = await runAiken({ cwd, args: addressArgs, timeoutMs: params.timeoutMs });
  const policyRes = await runAiken({ cwd, args: policyArgs, timeoutMs: params.timeoutMs });

  const hashStep = normalizeStep(hashRes);
  const addressStep = normalizeStep(addrRes);
  const policyStep = normalizeStep(policyRes);

  const structuredContent: IntegrationBundleStructuredContent = {
    cwd,
    selector: { module: params.module, validator: params.validator },
    steps: {
      hash: hashStep,
      address: addressStep,
      policy: policyStep
    }
  };

  if (hashRes.ok && hashRes.exitCode === 0) structuredContent.hash = hashRes.stdout.trim();
  if (addrRes.ok && addrRes.exitCode === 0) structuredContent.address = addrRes.stdout.trim();
  if (policyRes.ok && policyRes.exitCode === 0) structuredContent.policyId = policyRes.stdout.trim();

  const wantsConvert = params.includeCardanoCliScript || params.includeEvolutionSdkSnippet || params.includeLucidSnippet;

  if (wantsConvert) {
    const convertArgs = [
      "blueprint",
      "convert",
      ...(params.module ? ["--module", params.module] : []),
      ...(params.validator ? ["--validator", params.validator] : []),
      "--to",
      "cardano-cli"
    ];
    const convertRes = await runAiken({ cwd, args: convertArgs, timeoutMs: params.timeoutMs });
    const convertStep = normalizeStep(convertRes);
    structuredContent.steps.convert = convertStep;

    if (convertRes.ok && convertRes.exitCode === 0) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(convertRes.stdout) as unknown;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          structuredContent,
          errors: [`convert: failed to parse JSON (${message})`]
        };
      }

      const script = cardanoCliScriptSchema.safeParse(parsed);
      if (!script.success) {
        return {
          structuredContent,
          errors: ["Unexpected cardano-cli JSON shape from aiken."]
        };
      }

      structuredContent.cardanoCliScript = script.data;

      const plutusVersion = mapCardanoCliTypeToPlutusVersion(String(script.data.type));

      if (params.includeEvolutionSdkSnippet) {
        const baseName =
          params.evolutionExportName ??
          toIdentifier(params.validator ?? "script", { fallback: "script", prefixIfStartsDigit: "s_" });
        const evolutionSnippet = generateEvolutionSdkSnippet({
          cborHex: script.data.cborHex,
          plutusVersion,
          exportName: baseName,
          networkId: params.evolutionNetworkId ?? 0,
          includeAddressAndHashes: params.evolutionIncludeAddressAndHashes ?? true
        });
        structuredContent.evolutionSdkSnippetTs = evolutionSnippet;

        if (params.evolutionOutputPath) {
          const absOut = resolveWorkspacePath(cwd, params.evolutionOutputPath);
          await fs.mkdir(path.dirname(absOut), { recursive: true });
          await fs.writeFile(absOut, evolutionSnippet, "utf8");
          structuredContent.writtenEvolutionSnippetFile = absOut;
        }
      }

      if (params.includeLucidSnippet) {
        const chosenKind = params.lucidKind ?? "spending";
        const baseName =
          params.lucidExportName ??
          toIdentifier(params.validator ?? (chosenKind === "minting" ? "policy" : "validator"), {
            fallback: "validator",
            prefixIfStartsDigit: "v_"
          });

        const lucidSnippet = generateLucidEvolutionSnippet({
          cborHex: script.data.cborHex,
          plutusVersion,
          exportName: baseName,
          kind: chosenKind,
          includeAddressOrPolicyId: params.lucidIncludeAddressOrPolicyId ?? true
        });
        structuredContent.lucidEvolutionSnippetTs = lucidSnippet;

        if (params.lucidOutputPath) {
          const absOut = resolveWorkspacePath(cwd, params.lucidOutputPath);
          await fs.mkdir(path.dirname(absOut), { recursive: true });
          await fs.writeFile(absOut, lucidSnippet, "utf8");
          structuredContent.writtenLucidSnippetFile = absOut;
        }
      }

      if (params.scriptOutputPath) {
        const absOut = resolveWorkspacePath(cwd, params.scriptOutputPath);
        await fs.mkdir(path.dirname(absOut), { recursive: true });
        const json = JSON.stringify(script.data, null, params.pretty === false ? 0 : 2) + "\n";
        await fs.writeFile(absOut, json, "utf8");
        structuredContent.writtenScriptFile = absOut;
      }
    }
  }

  const errors: string[] = [];
  if (!hashStep.ok) errors.push(`hash: ${hashStep.error}`);
  if (!addressStep.ok) errors.push(`address: ${addressStep.error}`);
  if (!policyStep.ok) errors.push(`policy: ${policyStep.error}`);
  if (structuredContent.steps.convert && !structuredContent.steps.convert.ok) {
    errors.push(`convert: ${structuredContent.steps.convert.error}`);
  }

  return { structuredContent, errors };
}

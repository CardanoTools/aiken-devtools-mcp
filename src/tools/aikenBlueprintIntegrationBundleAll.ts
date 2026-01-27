import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { runAiken, resolveWorkspacePath, type RunAikenResult } from "../aiken/runAiken";
import { readBlueprint } from "../blueprint/readBlueprint";
import { cardanoCliScriptSchema, mapCardanoCliTypeToPlutusVersion, toIdentifier } from "../codegen/cardanoCli";
import { generateEvolutionSdkSnippet, generateLucidEvolutionSnippet } from "../codegen/snippets";
import { getOptionalString, toBlueprintToolError, toBlueprintToolOk } from "./aikenBlueprintCommon";

type SplitTitle = { module?: string; validator?: string };

function splitTitle(title: string): SplitTitle {
  const lastDot = title.lastIndexOf(".");
  if (lastDot > 0 && lastDot < title.length - 1) {
    return { module: title.slice(0, lastDot), validator: title.slice(lastDot + 1) };
  }
  return { validator: title };
}

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
    onlyTitles: z
      .array(z.string())
      .optional()
      .describe("Optional list of validator titles to include (exact match). Defaults to all validators."),

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
    evolutionNetworkId: z
      .number()
      .int()
      .min(0)
      .max(15)
      .optional()
      .describe("Cardano network id for Evolution SDK snippet (default: 0)."),
    evolutionExportNamePrefix: z
      .string()
      .optional()
      .describe("Prefix for Evolution SDK identifiers (default: derived from validator)."),
    evolutionIncludeAddressAndHashes: z
      .boolean()
      .optional()
      .describe("If true, include helpers for script hash/policyId/address in Evolution SDK snippet."),
    includeLucidSnippet: z
      .boolean()
      .optional()
      .describe("If true, generate a @lucid-evolution/lucid snippet. Implies cardano-cli conversion."),
    lucidKind: z
      .enum(["spending", "minting"])
      .optional()
      .describe("Lucid snippet kind (default: spending)."),
    lucidExportNamePrefix: z
      .string()
      .optional()
      .describe("Prefix for Lucid identifiers (default: derived from validator)."),
    lucidIncludeAddressOrPolicyId: z
      .boolean()
      .optional()
      .describe("If true, include address/policyId helpers in Lucid snippet."),

    scriptOutputDir: z
      .string()
      .optional()
      .describe("If provided, writes cardano-cli JSON into this directory (relative to projectDir)."),
    evolutionOutputDir: z
      .string()
      .optional()
      .describe("If provided, writes Evolution SDK snippets into this directory (relative to projectDir)."),
    lucidOutputDir: z
      .string()
      .optional()
      .describe("If provided, writes Lucid snippets into this directory (relative to projectDir)."),
    pretty: z
      .boolean()
      .optional()
      .describe("Pretty-print JSON when writing scriptOutputDir (default: true)."),

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

const resultSchema = z
  .object({
    title: z.string(),
    module: z.string().optional(),
    validator: z.string().optional(),
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
      .strict(),
    errors: z.array(z.string()).optional()
  })
  .strict();

const outputSchema = z
  .object({
    cwd: z.string(),
    blueprintFilePath: z.string(),
    validatorCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    results: z.array(resultSchema)
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

export function registerAikenBlueprintIntegrationBundleAllTool(server: McpServer): void {
  server.registerTool(
    "aiken_blueprint_integration_bundle_all",
    {
      title: "Aiken: blueprint integration bundle (all validators)",
      description:
        "Computes integration outputs (hash, address, policy, optional cardano-cli JSON and snippets) for all validators in a blueprint.",
      inputSchema,
      outputSchema,
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
      onlyTitles,
      delegatedTo,
      mainnet,
      includeCardanoCliScript,
      includeEvolutionSdkSnippet,
      evolutionNetworkId,
      evolutionExportNamePrefix,
      evolutionIncludeAddressAndHashes,
      includeLucidSnippet,
      lucidKind,
      lucidExportNamePrefix,
      lucidIncludeAddressOrPolicyId,
      scriptOutputDir,
      evolutionOutputDir,
      lucidOutputDir,
      pretty,
      timeoutMs
    }) => {
      const blueprint = await readBlueprint({ projectDir, blueprintPath });
      if (!blueprint.ok) return toBlueprintToolError(blueprint.error);

      const cwd = blueprint.cwd;
      const validatorsRaw = Array.isArray(blueprint.blueprint.validators) ? blueprint.blueprint.validators : [];
      if (validatorsRaw.length === 0) return toBlueprintToolError("No validators found in blueprint.");

      const filterTitles = new Set((onlyTitles ?? []).map((t) => t.trim()).filter((t) => t.length));
      const validators = validatorsRaw
        .map((validator) => {
          const title = getOptionalString(validator, "title") ?? "";
          if (!title.length) return null;
          if (filterTitles.size > 0 && !filterTitles.has(title)) return null;
          return { title, split: splitTitle(title) };
        })
        .filter((v): v is { title: string; split: SplitTitle } => v !== null);

      const wantsConvert = includeCardanoCliScript || includeEvolutionSdkSnippet || includeLucidSnippet;

      const results: Array<z.infer<typeof resultSchema>> = [];
      let errorCount = 0;

      for (const entry of validators) {
        const module = entry.split.module;
        const validator = entry.split.validator;

        const commonFlags: string[] = [];
        if (blueprintPath) commonFlags.push("--in", blueprintPath);
        if (module) commonFlags.push("--module", module);
        if (validator) commonFlags.push("--validator", validator);

        const hashArgs = ["blueprint", "hash", ...commonFlags];
        const addressArgs = [
          "blueprint",
          "address",
          ...commonFlags,
          ...(delegatedTo ? ["--delegated-to", delegatedTo] : []),
          ...(mainnet ? ["--mainnet"] : [])
        ];
        const policyArgs = ["blueprint", "policy", ...commonFlags];

        const hashRes = await runAiken({ cwd, args: hashArgs, timeoutMs });
        const addrRes = await runAiken({ cwd, args: addressArgs, timeoutMs });
        const policyRes = await runAiken({ cwd, args: policyArgs, timeoutMs });

        const hashStep = normalizeStep(hashRes);
        const addressStep = normalizeStep(addrRes);
        const policyStep = normalizeStep(policyRes);

        const result: z.infer<typeof resultSchema> = {
          title: entry.title,
          module,
          validator,
          steps: { hash: hashStep, address: addressStep, policy: policyStep }
        };

        if (hashRes.ok && hashRes.exitCode === 0) result.hash = hashRes.stdout.trim();
        if (addrRes.ok && addrRes.exitCode === 0) result.address = addrRes.stdout.trim();
        if (policyRes.ok && policyRes.exitCode === 0) result.policyId = policyRes.stdout.trim();

        if (wantsConvert) {
          const convertArgs = [
            "blueprint",
            "convert",
            ...(module ? ["--module", module] : []),
            ...(validator ? ["--validator", validator] : []),
            "--to",
            "cardano-cli"
          ];
          const convertRes = await runAiken({ cwd, args: convertArgs, timeoutMs });
          const convertStep = normalizeStep(convertRes);
          result.steps.convert = convertStep;

          if (convertRes.ok && convertRes.exitCode === 0) {
            const parsed = JSON.parse(convertRes.stdout) as unknown;
            const script = cardanoCliScriptSchema.safeParse(parsed);
            if (script.success) {
              result.cardanoCliScript = script.data;

              const plutusVersion = mapCardanoCliTypeToPlutusVersion(String(script.data.type));
              const baseIdentifier = toIdentifier(validator ?? entry.title, { fallback: "script", prefixIfStartsDigit: "s_" });

              if (includeEvolutionSdkSnippet) {
                const prefix = evolutionExportNamePrefix ?? "";
                const exportName = prefix ? `${prefix}${baseIdentifier}` : baseIdentifier;
                const snippet = generateEvolutionSdkSnippet({
                  cborHex: script.data.cborHex,
                  plutusVersion,
                  exportName,
                  networkId: evolutionNetworkId ?? 0,
                  includeAddressAndHashes: evolutionIncludeAddressAndHashes ?? true
                });
                result.evolutionSdkSnippetTs = snippet;

                if (evolutionOutputDir) {
                  const absDir = resolveWorkspacePath(cwd, evolutionOutputDir);
                  await fs.mkdir(absDir, { recursive: true });
                  const outPath = path.join(absDir, `${baseIdentifier}.evolution.ts`);
                  await fs.writeFile(outPath, snippet, "utf8");
                  result.writtenEvolutionSnippetFile = outPath;
                }
              }

              if (includeLucidSnippet) {
                const chosenKind = lucidKind ?? "spending";
                const prefix = lucidExportNamePrefix ?? "";
                const baseName = toIdentifier(
                  validator ?? (chosenKind === "minting" ? "policy" : "validator"),
                  { fallback: "validator", prefixIfStartsDigit: "v_" }
                );
                const exportName = prefix ? `${prefix}${baseName}` : baseName;

                const snippet = generateLucidEvolutionSnippet({
                  cborHex: script.data.cborHex,
                  plutusVersion,
                  exportName,
                  kind: chosenKind,
                  includeAddressOrPolicyId: lucidIncludeAddressOrPolicyId ?? true
                });
                result.lucidEvolutionSnippetTs = snippet;

                if (lucidOutputDir) {
                  const absDir = resolveWorkspacePath(cwd, lucidOutputDir);
                  await fs.mkdir(absDir, { recursive: true });
                  const outPath = path.join(absDir, `${baseIdentifier}.lucid.ts`);
                  await fs.writeFile(outPath, snippet, "utf8");
                  result.writtenLucidSnippetFile = outPath;
                }
              }

              if (includeCardanoCliScript && scriptOutputDir) {
                const absDir = resolveWorkspacePath(cwd, scriptOutputDir);
                await fs.mkdir(absDir, { recursive: true });
                const outPath = path.join(absDir, `${baseIdentifier}.cardano-cli.json`);
                const json = JSON.stringify(script.data, null, pretty === false ? 0 : 2) + "\n";
                await fs.writeFile(outPath, json, "utf8");
                result.writtenScriptFile = outPath;
              }
            } else {
              result.errors = result.errors ?? [];
              result.errors.push("Unexpected cardano-cli JSON shape from aiken.");
            }
          }
        }

        result.errors = result.errors ?? [];
        if (!hashStep.ok) result.errors.push(`hash: ${hashStep.error}`);
        if (!addressStep.ok) result.errors.push(`address: ${addressStep.error}`);
        if (!policyStep.ok) result.errors.push(`policy: ${policyStep.error}`);
        if (result.steps.convert && !result.steps.convert.ok) {
          result.errors.push(`convert: ${result.steps.convert.error}`);
        }

        if (result.errors.length === 0) delete result.errors;
        if (result.errors) errorCount += 1;

        results.push(result);
      }

      const structuredContent: z.infer<typeof outputSchema> = {
        cwd,
        blueprintFilePath: blueprint.blueprintFile.path,
        validatorCount: results.length,
        errorCount,
        results
      };

      const message = errorCount
        ? `Computed bundles for ${results.length} validators with ${errorCount} error(s).`
        : `Computed bundles for ${results.length} validators.`;

      return toBlueprintToolOk(message, structuredContent);
    }
  );
}

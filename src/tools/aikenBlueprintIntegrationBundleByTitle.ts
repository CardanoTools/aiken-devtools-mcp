import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { readBlueprint } from "../blueprint/readBlueprint";
import { computeIntegrationBundle, integrationBundleOutputSchema } from "./aikenBlueprintIntegrationBundle";
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
    title: z
      .string()
      .min(1)
      .describe("Validator title to fetch (exact match as in blueprint.validators[].title)."),

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

const outputSchema = z
  .object({
    title: z.string(),
    module: z.string().optional(),
    validator: z.string().optional(),
    bundle: integrationBundleOutputSchema
  })
  .strict();

export function registerAikenBlueprintIntegrationBundleByTitleTool(server: McpServer): void {
  server.registerTool(
    "aiken_blueprint_integration_bundle_by_title",
    {
      title: "Aiken: blueprint integration bundle (by title)",
      description:
        "Computes integration-critical outputs from an Aiken blueprint for a validator selected by its title (as listed in the blueprint).",
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
      title,
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
      const blueprint = await readBlueprint({ projectDir, blueprintPath });
      if (!blueprint.ok) return toBlueprintToolError(blueprint.error);

      const validatorsRaw = Array.isArray(blueprint.blueprint.validators) ? blueprint.blueprint.validators : [];
      const titleTrimmed = title.trim();
      const chosen = validatorsRaw.find((v) => getOptionalString(v, "title") === titleTrimmed);
      if (!chosen) {
        return toBlueprintToolError(`Validator not found with title: ${titleTrimmed}`);
      }

      const split = splitTitle(titleTrimmed);
      const { structuredContent, errors } = await computeIntegrationBundle({
        workspaceRoot: process.cwd(),
        projectDir,
        blueprintPath,
        module: split.module,
        validator: split.validator,
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

      const structured: z.infer<typeof outputSchema> = {
        title: titleTrimmed,
        module: split.module,
        validator: split.validator,
        bundle: structuredContent
      };

      if (errors.length) {
        return {
          isError: true,
          content: [{ type: "text", text: errors.join("\n") }],
          structuredContent: structured
        };
      }

      return toBlueprintToolOk("Computed blueprint integration bundle.", structured);
    }
  );
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { readBlueprint } from "../blueprint/readBlueprint";
import { getOptionalString, hasOwn, toBlueprintToolError, toBlueprintToolOk } from "./aikenBlueprintCommon";

const inputSchema = z
  .object({
    projectDir: z
      .string()
      .optional()
      .describe("Project directory (relative to the current workspace). Defaults to workspace root."),
    blueprintPath: z
      .string()
      .optional()
      .describe("Path to blueprint JSON relative to projectDir (default: plutus.json)."),
    includeCompiledCode: z
      .boolean()
      .optional()
      .describe("Include compiled code blobs in output (can be very large). Default: false.")
  })
  .strict();

const validatorSummarySchema = z
  .object({
    title: z.string(),
    hash: z.string().optional(),
    hasDatum: z.boolean(),
    hasRedeemer: z.boolean(),
    parameterCount: z.number().int().nonnegative(),
    hasProgram: z.boolean(),
    hasCompiledCode: z.boolean(),
    compiledCodeLength: z.number().int().nonnegative().optional(),
    compiledCode: z.string().optional()
  })
  .strict();

const outputSchema = z
  .object({
    cwd: z.string(),
    blueprintFilePath: z.string(),
    validatorCount: z.number().int().nonnegative(),
    validators: z.array(validatorSummarySchema)
  })
  .strict();

export function registerAikenBlueprintListValidatorsTool(server: McpServer): void {
  server.registerTool(
    "aiken_blueprint_list_validators",
    {
      title: "Aiken: blueprint list validators",
      description: "Reads a blueprint JSON (default: plutus.json) and lists validators with basic metadata.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, blueprintPath, includeCompiledCode }) => {
      const result = await readBlueprint({ projectDir, blueprintPath });
      if (!result.ok) return toBlueprintToolError(result.error);

      const validatorsRaw = Array.isArray(result.blueprint.validators) ? result.blueprint.validators : [];

      const validators = validatorsRaw
        .map((validator) => {
          const title = getOptionalString(validator, "title") ?? "";
          if (!title.length) return null;

          const hash = getOptionalString(validator, "hash");
          const compiledCode = getOptionalString(validator, "compiledCode") ?? getOptionalString(validator, "compiled_code");

          const parameters = (validator as Record<string, unknown>).parameters;
          const parameterCount = Array.isArray(parameters) ? parameters.length : 0;

          const hasProgram = hasOwn(validator, "program");
          const hasDatum = hasOwn(validator, "datum");
          const hasRedeemer = hasOwn(validator, "redeemer");

          const summary: z.infer<typeof validatorSummarySchema> = {
            title,
            hash,
            hasDatum,
            hasRedeemer,
            parameterCount,
            hasProgram,
            hasCompiledCode: typeof compiledCode === "string" && compiledCode.length > 0,
            compiledCodeLength: typeof compiledCode === "string" ? compiledCode.length : undefined,
            compiledCode: includeCompiledCode ? compiledCode : undefined
          };

          return summary;
        })
        .filter((v): v is z.infer<typeof validatorSummarySchema> => v !== null);

      const structuredContent: z.infer<typeof outputSchema> = {
        cwd: result.cwd,
        blueprintFilePath: result.blueprintFile.path,
        validatorCount: validators.length,
        validators
      };

      return toBlueprintToolOk(`Found ${validators.length} validators.`, structuredContent);
    }
  );
}

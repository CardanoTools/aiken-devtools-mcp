import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { readBlueprint } from "../../blueprint/readBlueprint.js";
import { getOptionalString, toBlueprintToolError, toBlueprintToolOk } from "./aikenBlueprintCommon.js";

type UnknownRecord = Record<string, unknown>;

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
    title: z
      .string()
      .optional()
      .describe("Validator title to fetch (exact match as in blueprint.validators[].title)."),
    index: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Validator index to fetch (0-based). Used if title is not provided."),
    includeCompiledCode: z
      .boolean()
      .optional()
      .describe("Include compiled code blobs in output (can be very large). Default: false."),
    includeDefinitions: z
      .boolean()
      .optional()
      .describe("Include blueprint definitions map (can be large). Default: false."),
    includeBlueprintPreamble: z
      .boolean()
      .optional()
      .describe("Include blueprint preamble in output. Default: true.")
  })
  .strict();

const outputSchema = z
  .object({
    cwd: z.string(),
    blueprintFilePath: z.string(),
    preamble: z.unknown().optional(),
    validator: z.record(z.unknown()),
    definitions: z.record(z.unknown()).optional()
  })
  .strict();

function stripLargeFields(validator: UnknownRecord, includeCompiledCode: boolean | undefined): UnknownRecord {
  if (includeCompiledCode) return validator;

  const copied: UnknownRecord = { ...validator };

  if (typeof copied.compiledCode === "string") delete copied.compiledCode;
  if (typeof copied.compiled_code === "string") delete copied.compiled_code;

  return copied;
}

export function registerAikenBlueprintGetValidatorTool(server: McpServer): void {
  server.registerTool(
    "aiken_blueprint_get_validator",
    {
      title: "Aiken: blueprint get validator",
      description: "Reads a blueprint JSON (default: plutus.json) and returns one validator entry by title or index.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({
      projectDir,
      blueprintPath,
      title,
      index,
      includeCompiledCode,
      includeDefinitions,
      includeBlueprintPreamble
    }) => {
      const result = await readBlueprint({ projectDir, blueprintPath });
      if (!result.ok) return toBlueprintToolError((result as { ok: false; error: string }).error);

      const validatorsRaw = Array.isArray(result.blueprint.validators) ? result.blueprint.validators : [];
      if (validatorsRaw.length === 0) {
        return toBlueprintToolError("No validators found in blueprint.");
      }

      let chosen: UnknownRecord | undefined;

      if (title && title.trim().length) {
        chosen = validatorsRaw.find((v) => getOptionalString(v, "title") === title.trim()) as UnknownRecord | undefined;
        if (!chosen) {
          return toBlueprintToolError(`Validator not found with title: ${title.trim()}`);
        }
      } else {
        const idx = index ?? 0;
        if (idx < 0 || idx >= validatorsRaw.length) {
          return toBlueprintToolError(`Validator index out of range: ${idx} (0..${validatorsRaw.length - 1})`);
        }
        chosen = validatorsRaw[idx] as UnknownRecord;
      }

      const validator = stripLargeFields(chosen, includeCompiledCode);

      const structuredContent: z.infer<typeof outputSchema> = {
        cwd: result.cwd,
        blueprintFilePath: result.blueprintFile.path,
        preamble: includeBlueprintPreamble === false ? undefined : result.blueprint.preamble,
        validator: validator as Record<string, unknown>,
        definitions: includeDefinitions ? result.blueprint.definitions : undefined
      };

      const validatorTitle = getOptionalString(validator, "title") ?? "(untitled)";
      return toBlueprintToolOk(`Loaded validator: ${validatorTitle}`, structuredContent);
    }
  );
}

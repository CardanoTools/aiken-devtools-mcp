import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { readBlueprint } from "../../blueprint/readBlueprint.js";
import { toBlueprintToolError, toBlueprintToolOk } from "./aikenBlueprintCommon.js";

const inputSchema = z
  .object({
    projectDir: z
      .string()
      .optional()
      .describe("Project directory (relative to the current workspace). Defaults to workspace root."),
    blueprintPath: z
      .string()
      .optional()
      .describe("Path to blueprint JSON relative to projectDir (default: plutus.json).")
  })
  .strict();

const outputSchema = z
  .object({
    cwd: z.string(),
    blueprintFilePath: z.string(),
    preamble: z.unknown().optional(),
    validatorCount: z.number().int().nonnegative(),
    hasDefinitions: z.boolean()
  })
  .strict();

export function registerAikenBlueprintPreambleTool(server: McpServer): void {
  server.registerTool(
    "aiken_blueprint_preamble",
    {
      title: "Aiken: blueprint preamble",
      description: "Reads a blueprint JSON (default: plutus.json) and returns preamble + basic counts.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ projectDir, blueprintPath }) => {
      const result = await readBlueprint({ projectDir, blueprintPath });
      if (!result.ok) return toBlueprintToolError((result as { ok: false; error: string }).error);

      const validatorCount = Array.isArray(result.blueprint.validators) ? result.blueprint.validators.length : 0;
      const hasDefinitions = !!result.blueprint.definitions && typeof result.blueprint.definitions === "object";

      const structuredContent: z.infer<typeof outputSchema> = {
        cwd: result.cwd,
        blueprintFilePath: result.blueprintFile.path,
        preamble: result.blueprint.preamble,
        validatorCount,
        hasDefinitions
      };

      return toBlueprintToolOk("Loaded blueprint preamble.", structuredContent);
    }
  );
}

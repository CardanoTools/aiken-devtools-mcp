import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { resolveWorkspacePath } from "../aiken/runAiken.js";

const blueprintSchema = z
  .object({
    preamble: z.unknown().optional(),
    validators: z.array(z.record(z.string(), z.unknown())).optional(),
    definitions: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough();

export type AikenBlueprint = z.infer<typeof blueprintSchema>;

export type ReadBlueprintArgs = {
  projectDir?: string;
  blueprintPath?: string;
};

export type ReadBlueprintResult =
  | {
    ok: true;
    cwd: string;
    blueprintFile: {
      path: string;
    };
    blueprint: AikenBlueprint;
  }
  | {
    ok: false;
    cwd: string;
    blueprintFile: {
      path: string;
    };
    error: string;
  };

export async function readBlueprint(params: ReadBlueprintArgs): Promise<ReadBlueprintResult> {
  const workspaceRoot = process.cwd();
  const cwd = resolveWorkspacePath(workspaceRoot, params.projectDir);

  const blueprintPath = params.blueprintPath?.trim().length ? params.blueprintPath.trim() : "plutus.json";
  const candidate = path.resolve(cwd, blueprintPath);
  const blueprintFilePath = resolveWorkspacePath(workspaceRoot, candidate);

  try {
    const raw = await fs.readFile(blueprintFilePath, "utf8");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        cwd,
        blueprintFile: { path: blueprintFilePath },
        error: `Invalid JSON in blueprint file: ${blueprintPath}`
      };
    }

    const blueprint = blueprintSchema.safeParse(parsed);
    if (!blueprint.success) {
      return {
        ok: false,
        cwd,
        blueprintFile: { path: blueprintFilePath },
        error: `Blueprint JSON did not match expected shape (expected an object with optional preamble/validators/definitions).`
      };
    }

    return {
      ok: true,
      cwd,
      blueprintFile: { path: blueprintFilePath },
      blueprint: blueprint.data
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Make missing-file errors a bit more actionable.
    if (message.includes("ENOENT")) {
      return {
        ok: false,
        cwd,
        blueprintFile: { path: blueprintFilePath },
        error: `Blueprint file not found at ${blueprintPath}. Run \`aiken build\` first, or pass blueprintPath explicitly.`
      };
    }

    return {
      ok: false,
      cwd,
      blueprintFile: { path: blueprintFilePath },
      error: message
    };
  }
}

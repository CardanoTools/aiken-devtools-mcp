import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath, runAiken, type RunAikenResult } from "../aiken/runAiken";

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

const cardanoCliScriptSchema = z
  .object({
    type: z.string(),
    description: z.string().optional(),
    cborHex: z.string()
  })
  .passthrough();

const outputSchema = z
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
      module,
      validator,
      delegatedTo,
      mainnet,
      includeCardanoCliScript,
      scriptOutputPath,
      pretty,
      timeoutMs
    }) => {
      const workspaceRoot = process.cwd();
      const cwd = resolveWorkspacePath(workspaceRoot, projectDir);

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

      const structuredContent: z.infer<typeof outputSchema> = {
        cwd,
        selector: { module, validator },
        steps: {
          hash: hashStep,
          address: addressStep,
          policy: policyStep
        }
      };

      if (hashRes.ok && hashRes.exitCode === 0) structuredContent.hash = hashRes.stdout.trim();
      if (addrRes.ok && addrRes.exitCode === 0) structuredContent.address = addrRes.stdout.trim();
      if (policyRes.ok && policyRes.exitCode === 0) structuredContent.policyId = policyRes.stdout.trim();

      if (includeCardanoCliScript) {
        const convertArgs = ["blueprint", "convert", ...(module ? ["--module", module] : []), ...(validator ? ["--validator", validator] : []), "--to", "cardano-cli"];
        const convertRes = await runAiken({ cwd, args: convertArgs, timeoutMs });
        const convertStep = normalizeStep(convertRes);
        structuredContent.steps.convert = convertStep;

        if (convertRes.ok && convertRes.exitCode === 0) {
          const parsed = JSON.parse(convertRes.stdout) as unknown;
          const script = cardanoCliScriptSchema.safeParse(parsed);
          if (!script.success) {
            return {
              isError: true,
              content: [{ type: "text", text: "Unexpected cardano-cli JSON shape from aiken." }],
              structuredContent
            };
          }

          structuredContent.cardanoCliScript = script.data;

          if (scriptOutputPath) {
            const absOut = resolveWorkspacePath(cwd, scriptOutputPath);
            await fs.mkdir(path.dirname(absOut), { recursive: true });
            const json = JSON.stringify(script.data, null, pretty === false ? 0 : 2) + "\n";
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

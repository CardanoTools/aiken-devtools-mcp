import { z } from "zod";

export const cardanoCliScriptSchema = z
  .object({
    type: z.string(),
    description: z.string().optional(),
    cborHex: z.string()
  })
  .passthrough();

export type CardanoCliScript = z.infer<typeof cardanoCliScriptSchema>;

export type PlutusVersion = "PlutusV1" | "PlutusV2" | "PlutusV3";

export function mapCardanoCliTypeToPlutusVersion(type: string): PlutusVersion | undefined {
  const t = type.toLowerCase();
  if (t.includes("v1")) return "PlutusV1";
  if (t.includes("v2")) return "PlutusV2";
  if (t.includes("v3")) return "PlutusV3";
  return undefined;
}

export function toIdentifier(
  input: string | undefined,
  options?: {
    fallback?: string;
    prefixIfStartsDigit?: string;
  }
): string {
  const fallback = options?.fallback ?? "script";
  const prefixIfStartsDigit = options?.prefixIfStartsDigit ?? "s_";

  const cleaned = (input ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");

  if (!cleaned.length) return fallback;
  if (/^[0-9]/.test(cleaned)) return `${prefixIfStartsDigit}${cleaned}`;
  return cleaned;
}

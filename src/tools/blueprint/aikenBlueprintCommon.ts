/**
 * Blueprint tool utilities.
 * Re-exports common utilities and provides blueprint-specific helpers.
 */

// Re-export common utilities for convenience
export {
  createErrorResponse,
  createSuccessResponse,
  getStringFromObject,
  getErrorMessage,
  type UnknownRecord,
  type BlueprintResult,
  isBlueprintOk,
  isBlueprintError,
  splitTitle
} from "../common/utils.js";

/**
 * Creates a blueprint-specific error response.
 * @deprecated Use createErrorResponse from utils.ts instead
 */
export function toBlueprintToolError(message: string): { isError: true; content: Array<{ type: "text"; text: string }> } {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }]
  };
}

/**
 * Creates a blueprint-specific success response.
 * @deprecated Use createSuccessResponse from utils.ts instead
 */
export function toBlueprintToolOk<TStructured>(
  message: string,
  structuredContent: TStructured
): { content: Array<{ type: "text"; text: string }>; structuredContent: TStructured } {
  return {
    content: [{ type: "text" as const, text: message }],
    structuredContent
  };
}

/**
 * Safely gets an optional string from an object.
 * @deprecated Use getStringFromObject from utils.ts instead
 */
export function getOptionalString(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Checks if an object has a specific property.
 */
export function hasOwn(obj: unknown, key: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  return Object.prototype.hasOwnProperty.call(obj, key);
}

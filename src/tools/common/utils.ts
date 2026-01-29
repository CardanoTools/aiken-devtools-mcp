/**
 * Shared utility functions for MCP tools.
 * Centralizes common operations to avoid code duplication.
 */

import { z } from "zod";

// ============================================================================
// CONSTANTS - Centralized magic numbers and defaults
// ============================================================================

/** Default chunk size for text embedding (characters) */
export const DEFAULT_CHUNK_SIZE = 3000;

/** Default overlap between chunks (characters) */
export const DEFAULT_CHUNK_OVERLAP = 200;

/** Default network ID for Cardano (0 = testnet, 1 = mainnet) */
export const DEFAULT_NETWORK_ID = 0;

/** Maximum line length for search result previews */
export const MAX_PREVIEW_LINE_LENGTH = 240;

/** Maximum characters for metadata preview in vectors */
export const MAX_METADATA_PREVIEW_LENGTH = 256;

/** Maximum results for knowledge search */
export const DEFAULT_MAX_SEARCH_RESULTS = 10;

/** Maximum files to scan in knowledge search */
export const DEFAULT_MAX_SEARCH_FILES = 500;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** Standard result type for operations that can fail */
export type OperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Blueprint read result discriminated union */
export type BlueprintResult =
  | { ok: true; cwd: string; blueprintFile: { path: string }; blueprint: unknown }
  | { ok: false; cwd: string; blueprintFile: { path: string }; error: string };

/** Unknown record type for dynamic objects */
export type UnknownRecord = Record<string, unknown>;

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a blueprint result is successful.
 */
export function isBlueprintOk(result: BlueprintResult): result is BlueprintResult & { ok: true } {
  return result.ok === true;
}

/**
 * Type guard to check if a blueprint result is an error.
 */
export function isBlueprintError(result: BlueprintResult): result is BlueprintResult & { ok: false } {
  return result.ok === false;
}

/**
 * Type guard for operation results.
 */
export function isOperationOk<T>(result: OperationResult<T>): result is { ok: true; data: T } {
  return result.ok === true;
}

/**
 * Safely extracts error message from a failed operation result.
 * Avoids unsafe type casts.
 */
export function getErrorMessage(result: { ok: false; error?: string } | { ok: true }): string {
  if (result.ok) return "";
  return (result as { ok: false; error?: string }).error ?? "Unknown error";
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Converts a string to a URL-safe slug.
 * - Removes protocol prefixes
 * - Converts to lowercase
 * - Replaces non-alphanumeric characters with hyphens
 * - Removes leading/trailing hyphens
 *
 * @param input - The string to slugify
 * @returns A URL-safe slug string
 *
 * @example
 * slugify("https://example.com/My Page") // "example-com-my-page"
 * slugify("Hello World!") // "hello-world"
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Splits a validator title into module and validator name components.
 * Handles various title formats used in Aiken blueprints.
 *
 * @param title - The validator title string (e.g., "module.validator" or "validator")
 * @returns Object with optional module and name properties
 *
 * @example
 * splitTitle("my_module.my_validator") // { module: "my_module", name: "my_validator" }
 * splitTitle("validator_name") // { module: undefined, name: "validator_name" }
 * splitTitle("a.b.c") // { module: "a.b", name: "c" }
 */
export function splitTitle(title: string): { module?: string; name?: string } {
  const idx = title.lastIndexOf(".");
  if (idx === -1) return { name: title };
  return {
    module: title.slice(0, idx),
    name: title.slice(idx + 1)
  };
}

/**
 * Truncates a string to a maximum length, adding ellipsis if truncated.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length (default: 200)
 * @returns The truncated string with ellipsis if needed
 */
export function truncateString(str: string, maxLength = 200): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Validates that a string is valid hexadecimal.
 *
 * @param hex - The string to validate
 * @returns True if the string is valid hex with even length
 */
export function isValidHex(hex: string): boolean {
  if (hex.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]*$/.test(hex);
}

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/**
 * Safely extracts a string value from an unknown object.
 *
 * @param obj - The object to extract from
 * @param key - The key to look up
 * @returns The string value or undefined
 */
export function getStringFromObject(obj: unknown, key: string): string | undefined {
  if (obj === null || typeof obj !== "object") return undefined;
  const value = (obj as UnknownRecord)[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Safely extracts a number value from an unknown object.
 */
export function getNumberFromObject(obj: unknown, key: string): number | undefined {
  if (obj === null || typeof obj !== "object") return undefined;
  const value = (obj as UnknownRecord)[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * Safely extracts a boolean value from an unknown object.
 */
export function getBooleanFromObject(obj: unknown, key: string): boolean | undefined {
  if (obj === null || typeof obj !== "object") return undefined;
  const value = (obj as UnknownRecord)[key];
  return typeof value === "boolean" ? value : undefined;
}

// ============================================================================
// URL UTILITIES
// ============================================================================

/** Result type for normalized GitHub URLs */
export interface NormalizedGithubUrl {
  remoteUrl: string;
  owner?: string;
  repo?: string;
  ref?: string;
  subPath?: string;
}

/**
 * Parses a GitHub URL and extracts repository information.
 * Handles various GitHub URL formats including tree/blob paths.
 *
 * @param url - The URL to parse
 * @returns Object with repository details, or just the raw URL if not a GitHub URL
 *
 * @example
 * normalizeGithubUrl("https://github.com/owner/repo")
 * // { remoteUrl: "https://github.com/owner/repo.git", owner: "owner", repo: "repo" }
 *
 * normalizeGithubUrl("https://github.com/owner/repo/tree/main/src")
 * // { remoteUrl: "https://github.com/owner/repo.git", owner: "owner", repo: "repo", ref: "main", subPath: "src" }
 */
export function normalizeGithubUrl(url: string): NormalizedGithubUrl {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes("github.com")) {
      return { remoteUrl: url };
    }

    const parts = parsed.pathname.replace(/^\//, "").split("/").filter(Boolean);
    if (parts.length < 2) {
      return { remoteUrl: url };
    }

    const owner = parts[0] ?? "";
    const repo = (parts[1] ?? "").replace(/\.git$/, "");

    // Detect tree/blob paths for branch/tag references
    let ref: string | undefined;
    let subPath: string | undefined;

    if (parts.length >= 4 && (parts[2] === "tree" || parts[2] === "blob")) {
      ref = parts[3];
      if (parts.length > 4) {
        subPath = parts.slice(4).join("/");
      }
    }

    return {
      remoteUrl: `https://github.com/${owner}/${repo}.git`,
      owner,
      repo,
      ref,
      subPath
    };
  } catch {
    return { remoteUrl: url };
  }
}

// ============================================================================
// MCP RESPONSE HELPERS
// ============================================================================

/**
 * Creates a standardized MCP error response.
 *
 * @param message - The error message to display
 * @returns MCP-compliant error response object
 */
export function createErrorResponse(message: string): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }]
  };
}

/**
 * Creates a standardized MCP success response with optional structured content.
 *
 * @param message - The success message to display
 * @param structuredContent - Optional structured data to include
 * @returns MCP-compliant success response object
 */
export function createSuccessResponse<T extends Record<string, unknown>>(
  message: string,
  structuredContent?: T
): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: T;
} {
  const response: {
    content: Array<{ type: "text"; text: string }>;
    structuredContent?: T;
  } = {
    content: [{ type: "text" as const, text: message }]
  };

  if (structuredContent !== undefined) {
    response.structuredContent = structuredContent;
  }

  return response;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/** Dangerous patterns that could indicate command injection */
const DANGEROUS_ARG_PATTERNS = [
  /^-{1,2}[^-]/,  // Allow flags like --flag or -f
  /[;&|`$(){}[\]<>]/,  // Block shell metacharacters
  /\.\./,  // Block path traversal
];

/**
 * Validates extraArgs for potential command injection.
 * Returns sanitized args or throws an error.
 *
 * @param args - Array of extra arguments to validate
 * @param maxArgs - Maximum number of args allowed (default: 20)
 * @returns The validated args array
 * @throws Error if validation fails
 */
export function validateExtraArgs(args: string[] | undefined, maxArgs = 20): string[] {
  if (!args || args.length === 0) return [];

  if (args.length > maxArgs) {
    throw new Error(`Too many extra arguments (max ${maxArgs})`);
  }

  for (const arg of args) {
    // Check for shell metacharacters (except in quoted strings)
    if (/[;&|`$(){}[\]<>]/.test(arg)) {
      throw new Error(`Invalid character in argument: ${arg.slice(0, 20)}`);
    }
  }

  return args;
}

/**
 * Validates that a path doesn't contain traversal attempts.
 *
 * @param pathStr - The path string to validate
 * @returns True if path is safe
 */
export function isPathSafe(pathStr: string): boolean {
  if (!pathStr) return true;
  // Check for path traversal patterns
  if (pathStr.includes("..")) return false;
  if (pathStr.includes("~")) return false;
  // Check for absolute paths on Unix/Windows
  if (pathStr.startsWith("/") && !pathStr.startsWith(process.cwd())) return false;
  if (/^[A-Za-z]:/.test(pathStr)) return false;
  return true;
}

/**
 * Validates a git ref (branch/tag name) for safe characters.
 *
 * @param ref - The git ref to validate
 * @returns True if ref is safe
 */
export function isGitRefSafe(ref: string): boolean {
  if (!ref) return true;
  // Git refs can contain alphanumeric, hyphens, underscores, slashes, and dots
  // But not consecutive dots, start with dot/slash, or end with dot/lock
  if (/^[./]|\.{2}|\.lock$|[~^:?*\[\]\\@{}\s]/.test(ref)) return false;
  return /^[a-zA-Z0-9._/-]+$/.test(ref);
}

// ============================================================================
// ZOD SCHEMA HELPERS
// ============================================================================

/**
 * Creates an empty Zod object schema for tools with no input.
 * Ensures consistency across discovery tools.
 */
export const emptyInputSchema = z.object({}).strict();

/**
 * Common schema for projectDir parameter.
 */
export const projectDirSchema = z
  .string()
  .optional()
  .refine((p) => !p || isPathSafe(p), { message: "Invalid path: contains traversal characters" })
  .describe("Project directory (relative to workspace root). Default: workspace root.");

/**
 * Common schema for extraArgs parameter with validation.
 */
export const extraArgsSchema = z
  .array(z.string().max(200, "Argument too long"))
  .max(20, "Maximum 20 extra arguments")
  .optional()
  .describe("Additional CLI arguments to pass. Use sparingly.");

/**
 * Common schema for output paths with validation.
 */
export const outputPathSchema = z
  .string()
  .max(500, "Path too long")
  .refine((p) => isPathSafe(p), { message: "Invalid output path: contains traversal characters" })
  .optional()
  .describe("Output file path (relative to project). Must not contain '..'.");


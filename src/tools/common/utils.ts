/**
 * Shared utility functions for MCP tools.
 * Centralizes common operations to avoid code duplication.
 */

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
export function normalizeGithubUrl(url: string): {
  remoteUrl: string;
  owner?: string;
  repo?: string;
  ref?: string;
  subPath?: string;
} {
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
 * Safely extracts a string value from an unknown object.
 *
 * @param obj - The object to extract from
 * @param key - The key to look up
 * @returns The string value or undefined
 */
export function getStringFromObject(obj: unknown, key: string): string | undefined {
  if (obj === null || typeof obj !== "object") return undefined;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

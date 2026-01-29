import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath } from "../../aiken/runAiken.js";
import { ALL_KNOWLEDGE_SOURCES, findSpecById, resolveScopePreset } from "../../knowledge/index.js";
import { resolveSourceDirPath } from "../../knowledge/core/utils.js";
import type { KnowledgeSource } from "../../knowledge/core/types.js";

const SCOPE_IDS = [
  "project",
  "core", "extended", "examples", "libraries", "docs", "all",
  ...ALL_KNOWLEDGE_SOURCES.map(s => s.id)
];
// z.enum expects a readonly tuple at compile-time; assert here to satisfy Typescript
const scopeSchema = z.enum(SCOPE_IDS as unknown as [string, ...string[]]);

const inputSchema = z
  .object({
    query: z.string()
      .min(1, "Query cannot be empty")
      .max(500, "Query too long (max 500 chars)")
      .describe("Text to search for (case-insensitive). Keep queries focused for best results."),
    scope: scopeSchema.optional().describe(
      "Search scope. Options: 'project' (current workspace), 'core' (stdlib+prelude), " +
      "'examples' (code patterns), 'libraries', 'docs', 'extended' (examples+libs), " +
      "'all' (everything), or a specific source ID. Default: 'all'."
    ),
    maxResults: z.number().int().positive().max(50).optional().describe(
      "Maximum matches to return (1-50, default: 10). Higher values increase token usage."
    ),
    maxFiles: z.number().int().positive().max(1000).optional().describe(
      "Maximum files to scan per scope (1-1000, default: 500). Use lower values for faster searches."
    ),
    fileExtensions: z
      .array(z.string().regex(/^\.[a-z0-9]+$/i, "Extension must start with '.' (e.g., '.ak')"))
      .max(10, "Maximum 10 file extensions")
      .optional()
      .describe("File extensions to include (default: ['.ak', '.md', '.toml']). Must start with '.'")
  })
  .strict();

const matchSchema = z
  .object({
    filePath: z.string(),
    line: z.number().int().positive(),
    text: z.string()
  })
  .strict();

const outputSchema = z
  .object({
    query: z.string(),
    scope: scopeSchema,
    searchedRoots: z.array(z.string()),
    matchCount: z.number().int().nonnegative(),
    matches: z.array(matchSchema),
    truncated: z.boolean()
  })
  .strict();

async function listFilesRecursively(rootDir: string, maxFiles: number): Promise<string[]> {
  const files: string[] = [];
  const queue: string[] = [rootDir];

  while (queue.length && files.length < maxFiles) {
    const dir = queue.shift()!;

    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const full = path.join(dir, entry.name);

      // Skip huge/noisy directories.
      if (entry.isDirectory()) {
        const name = entry.name;
        if (name === ".git" || name === "node_modules" || name === "dist" || name === "build" || name === ".aiken") {
          continue;
        }
        queue.push(full);
        continue;
      }

      if (entry.isFile()) files.push(full);
    }
  }

  return files;
}

function shouldIncludeFile(filePath: string, extensions: string[]): boolean {
  const ext = path.extname(filePath);
  return extensions.includes(ext);
}

async function searchFile(filePath: string, needleLower: string, maxLineLength: number) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    const matches: Array<{ line: number; text: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (lineText !== undefined && lineText.toLowerCase().includes(needleLower)) {
        // Token-efficient: shorter previews, focus on code
        const clipped = lineText.length > maxLineLength
          ? lineText.slice(0, maxLineLength - 1) + "…"
          : lineText;
        matches.push({ line: i + 1, text: clipped.trim() });
      }
    }

    return matches;
  } catch {
    return [];
  }
}

function resolveScopeRoots(scope: z.infer<typeof scopeSchema>): string[] {
  const workspaceRoot = process.cwd();

  const roots = new Set<string>();

  // Handle preset scopes
  if (scope === "project") {
    roots.add(workspaceRoot);
    return Array.from(roots);
  }

  // Use new preset system
  const presetIds = resolveScopePreset(scope);
  for (const id of presetIds) {
    const spec = findSpecById(id);
    if (spec) {
      roots.add(resolveSourceDirPath(spec));
    }
  }

  // Fallback for individual source IDs
  if (roots.size === 0) {
    const spec = findSpecById(scope as any);
    if (spec) {
      roots.add(resolveSourceDirPath(spec));
    }
  }

  return Array.from(roots);
}

export function registerAikenKnowledgeSearchTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_search",
    {
      title: "Aiken: knowledge search",
      description:
        "Searches for text across project and knowledge sources. " +
        "Scopes: project, core (essentials), extended (examples+libs), examples, libraries, docs, all, or specific source IDs. " +
        "Returns concise, token-efficient results.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ query, scope, maxResults, maxFiles, fileExtensions }) => {
      const effectiveScope = scope ?? "all";
      const roots = resolveScopeRoots(effectiveScope);

      const extensions = (fileExtensions?.length ? fileExtensions : [".ak", ".md", ".toml"]).map((e) =>
        e.startsWith(".") ? e : `.${e}`
      );

      const limitResults = maxResults ?? 10; // Token-efficient default
      const limitFiles = maxFiles ?? 500; // Reasonable file limit
      const needleLower = query.toLowerCase();

      const workspaceRoot = process.cwd();

      const matches: Array<z.infer<typeof matchSchema>> = [];
      let truncated = false;

      for (const root of roots) {
        // Ensure root is within workspace, even for cached dirs.
        let safeRoot: string;
        try {
          safeRoot = resolveWorkspacePath(workspaceRoot, root);
        } catch {
          // skip roots that are not inside the workspace (e.g., not yet synced)
          continue;
        }

        // If root is a file, search it directly instead of recursing
        try {
          const stat = await fs.stat(safeRoot);
          if (stat.isFile()) {
            if (!shouldIncludeFile(safeRoot, extensions)) continue;

            const fileMatches = await searchFile(safeRoot, needleLower, 240);
            for (const fm of fileMatches) {
              matches.push({ filePath: safeRoot, line: fm.line, text: fm.text });
              if (matches.length >= limitResults) {
                truncated = true;
                break;
              }
            }

            if (truncated) break;
            continue;
          }
        } catch {
          // can't stat path - skip it
          continue;
        }

        const files = await listFilesRecursively(safeRoot, limitFiles);

        for (const filePath of files) {
          if (matches.length >= limitResults) {
            truncated = true;
            break;
          }

          if (!shouldIncludeFile(filePath, extensions)) continue;

          const fileMatches = await searchFile(filePath, needleLower, 240);
          for (const fm of fileMatches) {
            matches.push({ filePath, line: fm.line, text: fm.text });
            if (matches.length >= limitResults) {
              truncated = true;
              break;
            }
          }
        }

        if (truncated) break;
      }

      const structuredContent: z.infer<typeof outputSchema> = {
        query,
        scope: effectiveScope,
        searchedRoots: roots,
        matchCount: matches.length,
        matches,
        truncated
      };

      return {
        content: [{ type: "text", text: truncated ? `Found ${matches.length}+ matches (truncated).` : `Found ${matches.length} matches.` }],
        structuredContent
      };
    }
  );
}

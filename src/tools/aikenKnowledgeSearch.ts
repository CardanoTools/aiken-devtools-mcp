import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath } from "../aiken/runAiken";
import { getWorkspaceRoot, resolveRepoDirPath, type KnowledgeRepo } from "../knowledge/knowledgePaths";

const scopeSchema = z.enum(["project", "stdlib", "prelude", "evolution-sdk", "all"]);

const inputSchema = z
  .object({
    query: z.string().min(1).describe("Text to search for (case-insensitive)."),
    scope: scopeSchema.optional().describe("Where to search (default: all)."),
    maxResults: z.number().int().positive().max(200).optional().describe("Maximum matches to return (default: 50)."),
    maxFiles: z.number().int().positive().max(5000).optional().describe("Maximum files to scan per scope (default: 2000)."),
    fileExtensions: z
      .array(z.string())
      .optional()
      .describe("File extensions to include (default: ['.ak','.md','.toml']).")
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

    let entries: Array<fs.Dirent>;
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
      if (lineText.toLowerCase().includes(needleLower)) {
        const clipped = lineText.length > maxLineLength ? lineText.slice(0, maxLineLength - 1) + "…" : lineText;
        matches.push({ line: i + 1, text: clipped });
      }
    }

    return matches;
  } catch {
    return [];
  }
}

function resolveScopeRoots(scope: z.infer<typeof scopeSchema>): string[] {
  const workspaceRoot = getWorkspaceRoot();

  const roots: string[] = [];
  const addRepo = (repo: KnowledgeRepo) => {
    try {
      roots.push(resolveRepoDirPath(repo));
    } catch {
      // ignore
    }
  };

  if (scope === "project") roots.push(workspaceRoot);
  if (scope === "stdlib") addRepo("stdlib");
  if (scope === "prelude") addRepo("prelude");
  if (scope === "evolution-sdk") addRepo("evolution-sdk");
  if (scope === "all") {
    roots.push(workspaceRoot);
    addRepo("stdlib");
    addRepo("prelude");
    addRepo("evolution-sdk");
  }

  return roots;
}

export function registerAikenKnowledgeSearchTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_search",
    {
      title: "Aiken: knowledge search",
      description:
        "Searches for text across the project plus cached stdlib/prelude/evolution-sdk sources (run aiken_knowledge_sync first).",
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

      const limitResults = maxResults ?? 50;
      const limitFiles = maxFiles ?? 2000;
      const needleLower = query.toLowerCase();

      const workspaceRoot = getWorkspaceRoot();

      const matches: Array<z.infer<typeof matchSchema>> = [];
      let truncated = false;

      for (const root of roots) {
        // Ensure root is within workspace, even for cached dirs.
        const safeRoot = resolveWorkspacePath(workspaceRoot, root);
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

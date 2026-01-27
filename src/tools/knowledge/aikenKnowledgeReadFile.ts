import fs from "node:fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { resolveWorkspacePath } from "../../aiken/runAiken.js";

const inputSchema = z
  .object({
    path: z.string().min(1).describe("Workspace-relative path (or absolute workspace path) to read."),
    startLine: z.number().int().positive().optional().describe("1-based start line (default: 1)."),
    endLine: z.number().int().positive().optional().describe("1-based end line (default: startLine + 200)."),
    maxChars: z
      .number()
      .int()
      .positive()
      .max(200000)
      .optional()
      .describe("Max characters to return (default: 20000).")
  })
  .strict();

const outputSchema = z
  .object({
    path: z.string(),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    totalLines: z.number().int().nonnegative(),
    content: z.string(),
    truncated: z.boolean()
  })
  .strict();

export function registerAikenKnowledgeReadFileTool(server: McpServer): void {
  server.registerTool(
    "aiken_knowledge_read_file",
    {
      title: "Aiken: knowledge read file",
      description:
        "Reads a text file from the workspace (including the stdlib/prelude cache) with line-range selection.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async ({ path: userPath, startLine, endLine, maxChars }) => {
      const workspaceRoot = process.cwd();
      const absPath = resolveWorkspacePath(workspaceRoot, userPath);

      let raw: string;
      try {
        raw = await fs.readFile(absPath, "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { isError: true, content: [{ type: "text", text: message }] };
      }

      const lines = raw.split(/\r?\n/);
      const totalLines = lines.length;

      const from = Math.max(1, startLine ?? 1);
      const to = Math.min(totalLines, endLine ?? Math.min(totalLines, from + 200));

      const slice = lines.slice(from - 1, to);
      let content = slice.join("\n");

      const limit = maxChars ?? 20000;
      let truncated = false;
      if (content.length > limit) {
        content = content.slice(0, limit - 1) + "…";
        truncated = true;
      }

      const structuredContent: z.infer<typeof outputSchema> = {
        path: absPath,
        startLine: from,
        endLine: to,
        totalLines,
        content,
        truncated
      };

      return {
        content: [{ type: "text", text: truncated ? "Read file (truncated)." : "Read file." }],
        structuredContent
      };
    }
  );
}

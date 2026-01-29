import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";

const inputSchema = z
  .object({
    query: z.string()
      .min(1, "Query cannot be empty")
      .max(200, "Query too long (max 200 chars)")
      .describe("Search text to match against tool names, titles, and descriptions (case-insensitive)."),
    maxResults: z.number()
      .int()
      .positive()
      .max(50, "Maximum 50 results")
      .optional()
      .describe("Maximum tools to return (1-50, default: 20). Lower values for faster response.")
  })
  .strict();

/**
 * Schema for tool search results
 */
const toolResultSchema = z.object({
  name: z.string().describe("Tool identifier (e.g., 'aiken_build')"),
  title: z.string().optional().describe("Human-readable title"),
  description: z.string().optional().describe("Tool description"),
  category: z.string().optional().describe("Tool category (project, blueprint, knowledge, etc.)"),
  safety: z.enum(["safe", "destructive", "network"]).optional().describe("Safety classification"),
  toolsets: z.array(z.string()).optional().describe("Toolsets this tool belongs to")
});

const outputSchema = z
  .object({
    query: z.string().describe("The search query used"),
    matchCount: z.number().int().nonnegative().describe("Number of matching tools"),
    tools: z.array(toolResultSchema)
  })
  .strict();

export function registerAikenToolSearchTool(server: McpServer): void {
  server.registerTool(
    "aiken_tool_search",
    {
      title: "Aiken: tool search",
      description:
        "Search available MCP tools by name, title, or description. " +
        "Use this to discover tools for specific tasks like 'build', 'test', 'blueprint', etc. " +
        "Returns matching tools with their category and safety classification.",
      inputSchema,
      outputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false }
    },
    async ({ query, maxResults }) => {
      try {
        const raw = await fs.readFile(path.join(process.cwd(), "mcp-tools.json"), "utf8");
        const parsed = JSON.parse(raw) as {
          tools?: Array<Record<string, unknown>>;
          toolsets?: Record<string, string[]>;
        };
        const tools = Array.isArray(parsed.tools) ? parsed.tools : [];

        const q = query.toLowerCase();
        const matches = tools
          .filter((t) => {
            if (!t || typeof t.name !== "string") return false;
            const name = (t.name as string).toLowerCase();
            const title = (typeof t.title === "string" ? t.title : "").toLowerCase();
            const desc = (typeof t.description === "string" ? t.description : "").toLowerCase();
            return name.includes(q) || title.includes(q) || desc.includes(q);
          })
          .slice(0, maxResults ?? 20)
          .map((t) => ({
            name: t.name as string,
            title: typeof t.title === "string" ? t.title : undefined,
            description: typeof t.description === "string" ? t.description : undefined,
            category: typeof t.category === "string" ? t.category : undefined,
            safety: typeof t.safety === "string" ? t.safety as "safe" | "destructive" | "network" : undefined,
            toolsets: [] as string[]
          }));

        // Attach toolsets for each matched tool
        if (parsed.toolsets) {
          const reverseMap: Record<string, string[]> = {};
          for (const [tsName, members] of Object.entries(parsed.toolsets)) {
            if (!Array.isArray(members)) continue;
            for (const member of members) {
              if (!reverseMap[member]) reverseMap[member] = [];
              (reverseMap[member] as string[]).push(tsName);
            }
          }
          for (const match of matches) {
            match.toolsets = reverseMap[match.name] ?? [];
          }
        }

        const structuredContent = {
          query,
          matchCount: matches.length,
          tools: matches
        };

        return {
          content: [{
            type: "text",
            text: matches.length > 0
              ? `Found ${matches.length} tool(s) matching "${query}"`
              : `No tools found matching "${query}"`
          }],
          structuredContent
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Tool search failed: ${message}` }]
        };
      }
    }
  );
}

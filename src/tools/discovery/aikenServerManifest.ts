import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Schema for a single tool entry in the manifest
 */
const toolEntrySchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string().optional(),
  safety: z.enum(["safe", "destructive", "network"]).optional(),
  category: z.string().optional(),
  insiders: z.boolean().optional()
}).passthrough();

/**
 * Schema for the complete MCP tools manifest
 */
const outputSchema = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  version: z.string(),
  tools: z.array(toolEntrySchema),
  toolsets: z.record(z.string(), z.array(z.string())).optional()
}).passthrough();

export function registerAikenServerManifestTool(server: McpServer): void {
  server.registerTool(
    "aiken_server_manifest",
    {
      title: "Aiken: server manifest",
      description:
        "Returns the MCP server's tool manifest (mcp-tools.json) containing all registered tools, " +
        "their schemas, safety classifications, categories, and toolsets for service discovery and introspection. " +
        "Use this to understand what tools are available and how they are organized.",
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false
      }
    },
    async () => {
      try {
        const manifestPath = path.join(process.cwd(), "mcp-tools.json");
        const raw = await fs.readFile(manifestPath, "utf8");
        const parsed = JSON.parse(raw);

        // Validate the manifest structure
        const validated = outputSchema.safeParse(parsed);
        if (!validated.success) {
          return {
            isError: true,
            content: [{ type: "text", text: `Manifest validation failed: ${validated.error.message}` }]
          };
        }

        const toolCount = validated.data.tools?.length ?? 0;
        const toolsetCount = Object.keys(validated.data.toolsets ?? {}).length;

        return {
          content: [{
            type: "text",
            text: `Manifest loaded: ${toolCount} tools in ${toolsetCount} toolsets (v${validated.data.version})`
          }],
          structuredContent: validated.data
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text", text: `Failed to read manifest: ${message}` }]
        };
      }
    }
  );
}

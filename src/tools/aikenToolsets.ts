import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runtimeConfig } from "../runtimeConfig.js";

const listOutputSchema = z.object({ toolsets: z.record(z.array(z.string())), enabled: z.array(z.string()) }).strict();
const enableInputSchema = z.object({ toolsets: z.array(z.string()).min(1), enable: z.boolean().optional() }).strict();
const enableOutputSchema = z.object({ enabled: z.array(z.string()) }).strict();

export function registerAikenToolsetsTools(server: McpServer): void {
  server.registerTool(
    "aiken_toolsets_list",
    {
      title: "Aiken: list toolsets",
      description: "List available toolsets and currently enabled toolsets.",
      outputSchema: listOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true, destructiveHint: false, openWorldHint: false }
    },
    async () => {
      try {
        const map = runtimeConfig.toolsetsMap || {};
        const enabled = Array.from(runtimeConfig.allowedToolsets || []);
        return { content: [{ type: "text", text: "Toolsets returned" }], structuredContent: { toolsets: map, enabled } };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Failed to list toolsets: ${String(err)}` }] };
      }
    }
  );

  server.registerTool(
    "aiken_toolsets_enable",
    {
      title: "Aiken: enable toolsets",
      description: "Enable or disable toolsets at runtime (requires server started with --dynamic-toolsets).",
      inputSchema: enableInputSchema,
      outputSchema: enableOutputSchema,
      annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true, openWorldHint: false }
    },
    async ({ toolsets, enable }) => {
      if (!runtimeConfig.dynamicToolsets) {
        return { isError: true, content: [{ type: "text", text: "Dynamic toolsets not enabled on this server. Use --dynamic-toolsets to allow runtime changes." }] };
      }

      for (const t of toolsets) {
        if (enable === false) {
          runtimeConfig.allowedToolsets.delete(t);
        } else {
          runtimeConfig.allowedToolsets.add(t);
        }
      }

      return { content: [{ type: "text", text: "Toolsets updated" }], structuredContent: { enabled: Array.from(runtimeConfig.allowedToolsets) } };
    }
  );
}

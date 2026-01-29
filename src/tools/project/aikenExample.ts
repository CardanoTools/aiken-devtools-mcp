import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const inputSchema = z.object({ name: z.string().describe("A name for the example") }).strict() as z.ZodTypeAny;
const outputSchema = z.object({ message: z.string() }).strict() as z.ZodTypeAny;

export function registerAikenExampleTool(server: McpServer): void {
  server.registerTool(
    "aiken_example",
    {
      title: "Aiken: example",
      description: "Small example tool showing patterns used in this repo.",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false
      }
    },
    async (args) => {
      const { name } = args as { name: string };
      const message = `hello ${name}`;
      return {
        content: [{ type: "text" as const, text: message }],
        structuredContent: { message }
      };
    }
  );
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const inputSchema = z.object({ name: z.string().describe("A name for the example") }).strict();
const outputSchema = z.object({ message: z.string() }).strict();

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
    async ({ name }) => {
      return { message: `hello ${name}` };
    }
  );
}

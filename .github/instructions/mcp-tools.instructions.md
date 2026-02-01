---
applyTo: "src/tools/**/*.ts"
---

## MCP Tool Implementation Guidelines

When implementing MCP tools for aiken-devtools-mcp, follow these patterns:

1. **Use Zod schemas** - Define both `inputSchema` and `outputSchema` using Zod with `.strict()` to ensure type safety
1. **Add tool annotations** - Always include `annotations` with `readOnlyHint`, `idempotentHint`, and `destructiveHint` to help clients understand tool behavior
1. **Export registration function** - Export a `register<ToolName>(server: McpServer)` function that calls `server.registerTool()`
1. **Follow naming conventions** - Tool names use snake_case with `aiken_` prefix (e.g., `aiken_build`, `aiken_knowledge_search`)
1. **Update manifest** - Add the tool to `mcp-tools.json` with appropriate `safety`, `category`, and `toolsets` values
1. **Register in server.ts** - Import and call the registration function in `src/server.ts`
1. **Add descriptions** - Provide clear `title` and `description` fields, and use `.describe()` on schema fields
1. **Handle errors gracefully** - Return structured error responses rather than throwing exceptions
1. **Use async handlers** - Tool handlers should be async functions even if they don't await
1. **Respect readonly mode** - Tools that modify state should check runtime configuration or be marked as destructive

### Example Tool Structure

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const inputSchema = z.object({
  projectDir: z.string().optional().describe("Project directory path")
}).strict();

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string()
}).strict();

export function registerAikenExampleTool(server: McpServer): void {
  server.registerTool(
    "aiken_example",
    {
      title: "Aiken: example",
      description: "Example tool showing standard patterns",
      inputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false
      }
    },
    async (input) => {
      // Tool implementation
      return { success: true, message: "Done" };
    }
  );
}
```

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAikenDevtoolsServer } from "./server";

async function main(): Promise<void> {
  const server = createAikenDevtoolsServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  // MCP servers should write logs to stderr to avoid corrupting stdio transport.
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exitCode = 1;
});

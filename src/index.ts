import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAikenDevtoolsServer } from "./server";
import { applyCliOptions, loadPolicyFromFile, runtimeConfig } from "./runtimeConfig.js";

function printUsage(): void {
  // eslint-disable-next-line no-console
  console.error(`Usage: node dist/index.js [--transport stdio|tcp|ws] [--port N] [--readonly] [--allow-tools a,b] [--log <path>] [--max-fetch-size N]`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const opts: any = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--help" || a === "-h") {
      printUsage();
      return;
    }
    if (a === "--readonly") {
      opts.readonly = true;
      continue;
    }
    if (a === "--no-readonly") {
      opts.readonly = false;
      continue;
    }
    if (a === "--log") {
      opts.logFilePath = args[++i];
      continue;
    }
    if (a.startsWith("--allow-tools=")) {
      const val = a.split("=", 2)[1] || "";
      opts.allowedTools = val.split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (a === "--allow-tool") {
      const t = args[++i];
      opts.allowedTools = (opts.allowedTools || []).concat([t]);
      continue;
    }
    if (a === "--transport") {
      opts.transport = args[++i];
      continue;
    }
    if (a === "--port") {
      opts.port = Number(args[++i]) || undefined;
      continue;
    }
    if (a === "--max-fetch-size") {
      opts.maxFetchSize = Number(args[++i]) || undefined;
      continue;
    }

    // ignore unknown args for forward compatibility
  }

  applyCliOptions(opts);
  await loadPolicyFromFile();

  // write a startup log line to stderr (kept separate from stdio transport)
  // eslint-disable-next-line no-console
  console.error(`aiken-devtools-mcp: starting transport=${runtimeConfig.transport} readonly=${runtimeConfig.readonly}`);

  const server = createAikenDevtoolsServer();

  if (runtimeConfig.transport === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } else {
    // other transports can be added later; default to stdio
    // eslint-disable-next-line no-console
    console.error(`transport ${runtimeConfig.transport} not supported yet, falling back to stdio`);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((error) => {
  // MCP servers should write logs to stderr to avoid corrupting stdio transport.
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exitCode = 1;
});

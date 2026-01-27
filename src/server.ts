import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";

import { attachPolicyWrapper } from "./serverWrapper";
import { registerAikenBuildTool } from "./tools/aikenBuild";
import { registerAikenBlueprintAddressTool } from "./tools/aikenBlueprintAddress";
import { registerAikenBlueprintApplyTool } from "./tools/aikenBlueprintApply";
import { registerAikenBlueprintConvertTool } from "./tools/aikenBlueprintConvert";
import { registerAikenBlueprintExportCardanoCliTool } from "./tools/aikenBlueprintExportCardanoCli";
import { registerAikenBlueprintGetValidatorTool } from "./tools/aikenBlueprintGetValidator";
import { registerAikenBlueprintHashTool } from "./tools/aikenBlueprintHash";
import { registerAikenBlueprintIntegrationBundleTool } from "./tools/aikenBlueprintIntegrationBundle";
import { registerAikenBlueprintIntegrationBundleAllTool } from "./tools/aikenBlueprintIntegrationBundleAll";
import { registerAikenBlueprintIntegrationBundleByTitleTool } from "./tools/aikenBlueprintIntegrationBundleByTitle";
import { registerAikenBlueprintListValidatorsTool } from "./tools/aikenBlueprintListValidators";
import { registerAikenBlueprintPreambleTool } from "./tools/aikenBlueprintPreamble";
import { registerAikenBlueprintPolicyTool } from "./tools/aikenBlueprintPolicy";
import { registerAikenCheckTool } from "./tools/aikenCheck";
import { registerAikenCodegenLucidEvolutionTool } from "./tools/aikenCodegenLucidEvolution";
import { registerAikenCodegenEvolutionSdkTool } from "./tools/aikenCodegenEvolutionSdk";
import { registerAikenDocsTool } from "./tools/aikenDocs";
import { registerAikenFmtTool } from "./tools/aikenFmt";
import { registerAikenKnowledgeReadFileTool } from "./tools/aikenKnowledgeReadFile";
import { registerAikenKnowledgeSearchTool } from "./tools/aikenKnowledgeSearch";
import { registerAikenKnowledgeSyncTool } from "./tools/aikenKnowledgeSync";
import { registerAikenKnowledgeListTool } from "./tools/aikenKnowledgeList";
import { registerAikenKnowledgeAddTool } from "./tools/aikenKnowledgeAdd";
import { registerAikenKnowledgeIngestTool } from "./tools/aikenKnowledgeIngest";
import { registerAikenKnowledgeBulkIngestTool } from "./tools/aikenKnowledgeBulkIngest";
import { registerAikenKnowledgeProposalsListTool } from "./tools/aikenKnowledgeProposalsList";
import { registerAikenKnowledgeApproveTool } from "./tools/aikenKnowledgeApprove";
import { registerAikenKnowledgeIndexTool } from "./tools/aikenKnowledgeIndex";
import { registerAikenServerManifestTool } from "./tools/aikenServerManifest";
import { registerAikenToolsCatalogTool } from "./tools/aikenToolsCatalog";
import { registerAikenToolsetsTools } from "./tools/aikenToolsets";
import { registerAikenToolSearchTool } from "./tools/aikenToolSearch";
import { registerAikenTestTool } from "./tools/aikenTest";
import { registerAikenNewTool } from "./tools/aikenNew";
import { registerAikenVersionTool } from "./tools/aikenVersion";

export function createAikenDevtoolsServer(): McpServer {
  const server = new McpServer(
    {
      name: "aiken-devtools-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // attach policy & audit wrapper before registering tools
  attachPolicyWrapper(server);

  // register manifest as a resource for discovery
  try {
    server.registerResource(
      "mcp_tools_manifest",
      "/mcp-tools.json",
      { title: "MCP tools manifest", mimeType: "application/json" } as any,
      async () => {
        try {
          const raw = await fs.readFile(path.join(process.cwd(), "mcp-tools.json"), "utf8");
          return { contents: [{ uri: "/mcp-tools.json", mimeType: "application/json", text: raw }] } as any;
        } catch (err) {
          return { contents: [] } as any;
        }
      }
    );
  } catch {
    // ignore resource registration errors
  }

  // register prompts for Aiken development
  try {
    server.registerPrompt(
      "aiken_validator_template",
      { description: "Get a template for writing an Aiken validator" },
      async () => {
        return {
          description: "A basic Aiken validator template",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Here's a basic template for an Aiken validator:

\`\`\`aiken
validator {
  fn spend(datum: Data, redeemer: Data, context: Data) -> Bool {
    // Your validation logic here
    True
  }
}
\`\`\`

Use the aiken_blueprint_* tools to work with your validator blueprints.`
              }
            }
          ]
        };
      }
    );

    server.registerPrompt(
      "aiken_development_tips",
      { description: "Get tips for Aiken smart contract development" },
      async () => {
        return {
          description: "Tips for Aiken development",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Tips for Aiken smart contract development:

1. Use \`aiken check\` to validate your code before building.
2. Leverage the standard library for common operations.
3. Test your validators thoroughly with \`aiken test\`.
4. Use blueprints to manage validator metadata and addresses.
5. Format your code with \`aiken fmt\` for consistency.

Use the knowledge search tools to find examples and documentation.`
              }
            }
          ]
        };
      }
    );
  } catch {
    // ignore prompt registration errors
  }

  registerAikenVersionTool(server);
  registerAikenCheckTool(server);
  registerAikenBuildTool(server);
  registerAikenTestTool(server);
  registerAikenFmtTool(server);
  registerAikenDocsTool(server);
  registerAikenNewTool(server);

  registerAikenBlueprintPreambleTool(server);
  registerAikenBlueprintListValidatorsTool(server);
  registerAikenBlueprintGetValidatorTool(server);

  registerAikenBlueprintHashTool(server);
  registerAikenBlueprintAddressTool(server);
  registerAikenBlueprintPolicyTool(server);
  registerAikenBlueprintConvertTool(server);
  registerAikenBlueprintExportCardanoCliTool(server);
  registerAikenBlueprintIntegrationBundleTool(server);
  registerAikenBlueprintIntegrationBundleAllTool(server);
  registerAikenBlueprintIntegrationBundleByTitleTool(server);
  registerAikenBlueprintApplyTool(server);

  registerAikenKnowledgeSyncTool(server);
  registerAikenKnowledgeSearchTool(server);
  registerAikenKnowledgeReadFileTool(server);
  registerAikenKnowledgeListTool(server);
  registerAikenKnowledgeAddTool(server);
  registerAikenKnowledgeIngestTool(server);
  registerAikenKnowledgeBulkIngestTool(server);
  registerAikenKnowledgeProposalsListTool(server);
  registerAikenKnowledgeApproveTool(server);
  registerAikenKnowledgeIndexTool(server);

  registerAikenServerManifestTool(server);
  registerAikenToolsCatalogTool(server);
  registerAikenToolsetsTools(server);
  registerAikenToolSearchTool(server);
  registerAikenCodegenLucidEvolutionTool(server);
  registerAikenCodegenEvolutionSdkTool(server);

  return server;
}

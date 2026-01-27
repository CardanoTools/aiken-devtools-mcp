import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs/promises";
import path from "node:path";

import { attachPolicyWrapper } from "./serverWrapper.js";
import { registerAikenBuildTool } from "./tools/project/aikenBuild.js";
import { registerAikenBlueprintAddressTool } from "./tools/blueprint/aikenBlueprintAddress.js";
import { registerAikenBlueprintApplyTool } from "./tools/blueprint/aikenBlueprintApply.js";
import { registerAikenBlueprintConvertTool } from "./tools/blueprint/aikenBlueprintConvert.js";
import { registerAikenBlueprintExportCardanoCliTool } from "./tools/blueprint/aikenBlueprintExportCardanoCli.js";
import { registerAikenBlueprintGetValidatorTool } from "./tools/blueprint/aikenBlueprintGetValidator.js";
import { registerAikenBlueprintHashTool } from "./tools/blueprint/aikenBlueprintHash.js";
import { registerAikenBlueprintIntegrationBundleTool } from "./tools/blueprint/aikenBlueprintIntegrationBundle.js";
import { registerAikenBlueprintIntegrationBundleAllTool } from "./tools/blueprint/aikenBlueprintIntegrationBundleAll.js";
import { registerAikenBlueprintIntegrationBundleByTitleTool } from "./tools/blueprint/aikenBlueprintIntegrationBundleByTitle.js";
import { registerAikenBlueprintListValidatorsTool } from "./tools/blueprint/aikenBlueprintListValidators.js";
import { registerAikenBlueprintPreambleTool } from "./tools/blueprint/aikenBlueprintPreamble.js";
import { registerAikenBlueprintPolicyTool } from "./tools/blueprint/aikenBlueprintPolicy.js";
import { registerAikenCheckTool } from "./tools/project/aikenCheck.js";
import { registerAikenCodegenLucidEvolutionTool } from "./tools/codegen/aikenCodegenLucidEvolution.js";
import { registerAikenCodegenEvolutionSdkTool } from "./tools/codegen/aikenCodegenEvolutionSdk.js";
import { registerAikenDocsTool } from "./tools/project/aikenDocs.js";
import { registerAikenFmtTool } from "./tools/project/aikenFmt.js";
import { registerAikenKnowledgeReadFileTool } from "./tools/knowledge/aikenKnowledgeReadFile.js";
import { registerAikenKnowledgeSearchTool } from "./tools/knowledge/aikenKnowledgeSearch.js";
import { registerAikenKnowledgeSyncTool } from "./tools/knowledge/aikenKnowledgeSync.js";
import { registerAikenKnowledgeListTool } from "./tools/knowledge/aikenKnowledgeList.js";
import { registerAikenKnowledgeAddTool } from "./tools/knowledge/aikenKnowledgeAdd.js";
import { registerAikenKnowledgeIngestTool } from "./tools/knowledge/aikenKnowledgeIngest.js";
import { registerAikenKnowledgeBulkIngestTool } from "./tools/knowledge/aikenKnowledgeBulkIngest.js";
import { registerAikenKnowledgeProposalsListTool } from "./tools/knowledge/aikenKnowledgeProposalsList.js";
import { registerAikenKnowledgeApproveTool } from "./tools/knowledge/aikenKnowledgeApprove.js";
import { registerAikenKnowledgeIndexTool } from "./tools/knowledge/aikenKnowledgeIndex.js";
import { registerAikenServerManifestTool } from "./tools/discovery/aikenServerManifest.js";
import { registerAikenToolsCatalogTool } from "./tools/discovery/aikenToolsCatalog.js";
import { registerAikenToolsetsTools } from "./tools/discovery/aikenToolsets.js";
import { registerAikenToolSearchTool } from "./tools/discovery/aikenToolSearch.js";
import { registerAikenTestTool } from "./tools/project/aikenTest.js";
import { registerAikenNewTool } from "./tools/project/aikenNew.js";
import { registerAikenVersionTool } from "./tools/project/aikenVersion.js";

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

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
import { registerAikenTestTool } from "./tools/aikenTest";
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

  registerAikenVersionTool(server);
  registerAikenCheckTool(server);
  registerAikenBuildTool(server);
  registerAikenTestTool(server);
  registerAikenFmtTool(server);
  registerAikenDocsTool(server);

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
  registerAikenCodegenLucidEvolutionTool(server);
  registerAikenCodegenEvolutionSdkTool(server);

  return server;
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAikenBuildTool } from "./tools/aikenBuild";
import { registerAikenBlueprintAddressTool } from "./tools/aikenBlueprintAddress";
import { registerAikenBlueprintApplyTool } from "./tools/aikenBlueprintApply";
import { registerAikenBlueprintConvertTool } from "./tools/aikenBlueprintConvert";
import { registerAikenBlueprintExportCardanoCliTool } from "./tools/aikenBlueprintExportCardanoCli";
import { registerAikenBlueprintGetValidatorTool } from "./tools/aikenBlueprintGetValidator";
import { registerAikenBlueprintHashTool } from "./tools/aikenBlueprintHash";
import { registerAikenBlueprintIntegrationBundleTool } from "./tools/aikenBlueprintIntegrationBundle";
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
  registerAikenBlueprintApplyTool(server);

  registerAikenKnowledgeSyncTool(server);
  registerAikenKnowledgeSearchTool(server);
  registerAikenKnowledgeReadFileTool(server);

  registerAikenCodegenLucidEvolutionTool(server);
  registerAikenCodegenEvolutionSdkTool(server);

  return server;
}

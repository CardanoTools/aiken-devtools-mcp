import { KnowledgeSourceSpec } from "../types.js";

const ASSIST_URL = "https://github.com/logical-mechanism/Assist.git";
const ASSIST_REF = "main";
const ASSIST_FOLDER = "assist";

export const ASSIST_DOCS_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "assist-docs",
    remoteUrl: ASSIST_URL,
    defaultRef: ASSIST_REF,
    folderName: ASSIST_FOLDER,
    subPath: "docs",
    description: "Assist documentation: usage guides, API docs, and examples",
    category: "documentation",
  },
  {
    id: "assist-readme",
    remoteUrl: ASSIST_URL,
    defaultRef: ASSIST_REF,
    folderName: ASSIST_FOLDER,
    subPath: "README.md",
    description: "Repository README: overview and getting started",
    category: "documentation",
  },
];

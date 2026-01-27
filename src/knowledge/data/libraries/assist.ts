import { KnowledgeSourceSpec } from "../core/types.js";

const ASSIST_URL = "https://github.com/logical-mechanism/Assist.git";
const ASSIST_REF = "main";
const ASSIST_FOLDER = "assist";

export const ASSIST_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "assist-lib",
    remoteUrl: ASSIST_URL,
    defaultRef: ASSIST_REF,
    folderName: ASSIST_FOLDER,
    subPath: "lib",
    description: "Assist library source: Aiken modules and helpers",
    category: "library",
  },
];

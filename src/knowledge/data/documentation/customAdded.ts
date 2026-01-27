import { KnowledgeSourceSpec } from "../core/types.js";

export const CUSTOM_ADDED_SOURCES: KnowledgeSourceSpec[] = [
  { id: "aiken-lang-site", remoteUrl: "https://github.com/aiken-lang/site.git", defaultRef: "main", folderName: "aiken-lang-site", description: "GitHub - aiken-lang/site: Website and Docs for Aiken (ingested from https://github.com/aiken-lang/site)", category: "documentation" },
  { id: "example-repo", remoteUrl: "https://github.com/example/repo.git", defaultRef: "main", folderName: "example-repo", description: "example-repo (added)", category: "documentation" },
  { id: "aiken-lang-aiken", remoteUrl: "https://github.com/aiken-lang/aiken.git", defaultRef: "main", folderName: "aiken-lang-aiken", description: "GitHub - aiken-lang/aiken: A modern smart contract platform for Cardano (ingested from https://github.com/aiken-lang/aiken)", category: "documentation" }

];

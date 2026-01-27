import { KnowledgeSourceSpec } from "../core/types.js";

export const CUSTOM_ADDED_SOURCES: KnowledgeSourceSpec[] = [
  { id: "aiken-lang-site", remoteUrl: "https://github.com/aiken-lang/site.git", defaultRef: "main", folderName: "aiken-lang-site", description: "GitHub - aiken-lang/site: Website and Docs for Aiken (ingested from https://github.com/aiken-lang/site)", category: "documentation" },
  { id: "example-repo", remoteUrl: "https://github.com/example/repo.git", defaultRef: "main", folderName: "example-repo", description: "example-repo (added)", category: "documentation" },
  { id: "aiken-lang-aiken", remoteUrl: "https://github.com/aiken-lang/aiken.git", defaultRef: "main", folderName: "aiken-lang-aiken", description: "GitHub - aiken-lang/aiken: A modern smart contract platform for Cardano (ingested from https://github.com/aiken-lang/aiken)", category: "documentation" }
  ,
  // Additional curated references added for Copilot agents and knowledge ingestion
  { id: "aiken-awesome", remoteUrl: "https://github.com/aiken-lang/awesome-aiken.git", defaultRef: "main", folderName: "aiken-lang-awesome-aiken", description: "Awesome Aiken: curated list of Aiken resources (docs, libraries, examples)", category: "documentation" },
  { id: "mesh-aiken-template", remoteUrl: "https://github.com/MeshJS/aiken-next-ts-template.git", defaultRef: "main", folderName: "mesh-aiken-next-ts-template", description: "MeshJS Aiken Next.js TypeScript template: end-to-end Aiken + frontend example", category: "example" },
  { id: "cardano-academy-aiken-course", remoteUrl: "https://cardanofoundation.org/academy/course/aiken-eutxo-smart-contracts-cardano", defaultRef: "main", folderName: "cardano-academy-aiken-course", description: "Cardano Academy: 'Aiken: EUTxO Smart Contracts on Cardano' course (video + materials)", category: "documentation" }
]


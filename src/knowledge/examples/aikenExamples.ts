import { KnowledgeSourceSpec } from "../types.js";

const AIKEN_URL = "https://github.com/aiken-lang/aiken.git";
const AIKEN_REF = "main";
const AIKEN_FOLDER = "aiken";

export const AIKEN_EXAMPLE_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "aiken-example-hello-world",
    remoteUrl: AIKEN_URL,
    defaultRef: AIKEN_REF,
    folderName: AIKEN_FOLDER,
    subPath: "examples/hello_world",
    description: "Official Aiken 'Hello World' example",
    category: "example",
  },
  {
    id: "aiken-example-gift-card",
    remoteUrl: AIKEN_URL,
    defaultRef: AIKEN_REF,
    folderName: AIKEN_FOLDER,
    subPath: "examples/gift_card",
    description: "Official 'Gift Card' example (NFTs)",
    category: "example",
  },
  {
    id: "aiken-example-monorepo",
    remoteUrl: AIKEN_URL,
    defaultRef: AIKEN_REF,
    folderName: AIKEN_FOLDER,
    subPath: "examples/monorepo",
    description: "Monorepo example demonstrating workspace layouts",
    category: "example",
  },
  {
    id: "aiken-example-acceptance-tests",
    remoteUrl: AIKEN_URL,
    defaultRef: AIKEN_REF,
    folderName: AIKEN_FOLDER,
    subPath: "examples/acceptance_tests",
    description: "Acceptance tests and CI example folder for Aiken",
    category: "example",
  },
];

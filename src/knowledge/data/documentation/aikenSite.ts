/**
 * Official Aiken documentation from the aiken-lang/site repository.
 * Contains fundamentals, language tour, and getting started guides.
 */

import { KnowledgeSourceSpec } from "../core/types.js";

const AIKEN_SITE_URL = "https://github.com/aiken-lang/site.git";
const AIKEN_SITE_REF = "main";
const AIKEN_SITE_FOLDER = "aiken-site";

export const AIKEN_SITE_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "site-fundamentals",
    remoteUrl: AIKEN_SITE_URL,
    defaultRef: AIKEN_SITE_REF,
    folderName: AIKEN_SITE_FOLDER,
    subPath: "src/pages/fundamentals",
    description: "Core Aiken fundamentals: getting started, installation, editor setup, project structure, troubleshooting",
    category: "documentation",
  },
  {
    id: "site-language-tour",
    remoteUrl: AIKEN_SITE_URL,
    defaultRef: AIKEN_SITE_REF,
    folderName: AIKEN_SITE_FOLDER,
    subPath: "src/pages/language-tour.mdx",
    description: "Aiken language tour: syntax, types, functions, pattern matching, modules, tests, and more",
    category: "documentation",
  },
  {
    id: "site-installation-instructions",
    remoteUrl: AIKEN_SITE_URL,
    defaultRef: AIKEN_SITE_REF,
    folderName: AIKEN_SITE_FOLDER,
    subPath: "src/pages/installation-instructions.mdx",
    description: "Installation instructions: platform-specific steps and troubleshooting for Aiken",
    category: "documentation",
  },
  {
    id: "site-hello-world",
    remoteUrl: AIKEN_SITE_URL,
    defaultRef: AIKEN_SITE_REF,
    folderName: AIKEN_SITE_FOLDER,
    subPath: "src/pages/example--hello-world",
    description: "Aiken hello world example: step-by-step smart contract tutorial",
    category: "documentation",
  },
  {
    id: "site-vesting",
    remoteUrl: AIKEN_SITE_URL,
    defaultRef: AIKEN_SITE_REF,
    folderName: AIKEN_SITE_FOLDER,
    subPath: "src/pages/example--vesting",
    description: "Aiken vesting contract example: time-locked funds tutorial",
    category: "documentation",
  },
  {
    id: "site-uplc",
    remoteUrl: AIKEN_SITE_URL,
    defaultRef: AIKEN_SITE_REF,
    folderName: AIKEN_SITE_FOLDER,
    subPath: "src/pages/uplc",
    description: "UPLC (Untyped Plutus Core) documentation: bytecode format, debugging, optimization",
    category: "documentation",
  },
];

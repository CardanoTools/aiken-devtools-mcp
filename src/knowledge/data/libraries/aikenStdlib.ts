/**
 * Aiken standard library - utility modules for Cardano smart contracts.
 * Contains common functions for lists, options, bytestrings, crypto, and more.
 */

import { KnowledgeSourceSpec } from "../core/types.js";

const STDLIB_URL = "https://github.com/aiken-lang/stdlib.git";
const STDLIB_REF = "main";
const STDLIB_FOLDER = "aiken-stdlib";

export const AIKEN_STDLIB_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "stdlib",
    remoteUrl: STDLIB_URL,
    defaultRef: STDLIB_REF,
    folderName: STDLIB_FOLDER,
    subPath: "lib",
    description: "Aiken standard library root: all utility modules for Cardano smart contracts",
    category: "library",
  },
  {
    id: "stdlib-aiken",
    remoteUrl: STDLIB_URL,
    defaultRef: STDLIB_REF,
    folderName: STDLIB_FOLDER,
    subPath: "lib/aiken",
    description: "Aiken stdlib utility modules: collection, crypto, fuzz, math, primitive, and more",
    category: "library",
  },
  {
    id: "stdlib-cardano",
    remoteUrl: STDLIB_URL,
    defaultRef: STDLIB_REF,
    folderName: STDLIB_FOLDER,
    subPath: "lib/cardano",
    description: "Aiken stdlib Cardano-specific modules: address, assets, governance, script_context, transaction",
    category: "library",
  },
];

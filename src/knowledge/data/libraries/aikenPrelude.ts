/**
 * Aiken prelude - core built-in functions and types.
 * Contains fundamental types and functions available in every Aiken program.
 */

import { KnowledgeSourceSpec } from "../core/types.js";

const PRELUDE_URL = "https://github.com/aiken-lang/prelude.git";
const PRELUDE_REF = "main";
const PRELUDE_FOLDER = "aiken-prelude";

export const AIKEN_PRELUDE_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "prelude",
    remoteUrl: PRELUDE_URL,
    defaultRef: PRELUDE_REF,
    folderName: PRELUDE_FOLDER,
    subPath: "lib",
    description: "Aiken prelude: core built-in types and functions (Bool, Int, ByteArray, List, Option, etc.)",
    category: "library",
  },
];

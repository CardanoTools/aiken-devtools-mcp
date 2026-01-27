/**
 * Library knowledge sources.
 * Re-exports all library-related knowledge paths.
 */

export * from "./aikenStdlib.js";
export * from "./aikenPrelude.js";
export * from "./evolutionSdk.js";

import { KnowledgeSourceSpec } from "../types.js";
import { AIKEN_STDLIB_SOURCES } from "./aikenStdlib.js";
import { AIKEN_PRELUDE_SOURCES } from "./aikenPrelude.js";
import { EVOLUTION_SDK_SOURCES } from "./evolutionSdk.js";

/**
 * All library knowledge sources combined.
 */
export const LIBRARY_SOURCES: KnowledgeSourceSpec[] = [
  ...AIKEN_STDLIB_SOURCES,
  ...AIKEN_PRELUDE_SOURCES,
  ...EVOLUTION_SDK_SOURCES,
];

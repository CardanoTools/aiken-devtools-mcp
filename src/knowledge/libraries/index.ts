/**
 * Library knowledge sources.
 * Re-exports all library-related knowledge paths.
 */

export * from "./aikenStdlib.js";
export * from "./aikenPrelude.js";
export * from "./evolutionSdk.js";
export * from "./assist.js";
export * from "../awesome/awesomeAiken.js";

import { KnowledgeSourceSpec } from "../types.js";
import { AIKEN_STDLIB_SOURCES } from "./aikenStdlib.js";
import { AIKEN_PRELUDE_SOURCES } from "./aikenPrelude.js";
import { EVOLUTION_SDK_SOURCES } from "./evolutionSdk.js";
import { ASSIST_SOURCES } from "./assist.js";
import { AWESOME_AIKEN_LIBRARY_SOURCES } from "../awesome/awesomeAiken.js";

/**
 * All library knowledge sources combined.
 */
export const LIBRARY_SOURCES: KnowledgeSourceSpec[] = [
  ...AIKEN_STDLIB_SOURCES,
  ...AIKEN_PRELUDE_SOURCES,
  ...EVOLUTION_SDK_SOURCES,
  ...ASSIST_SOURCES,
  ...AWESOME_AIKEN_LIBRARY_SOURCES,
];

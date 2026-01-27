/**
 * Example knowledge sources.
 * (Add example projects, contracts, and code snippets here as needed.)
 */

export * from "./aikenExamples.js";

import { KnowledgeSourceSpec } from "../types.js";
import { AWESOME_AIKEN_EXAMPLE_SOURCES } from "../awesome/awesomeAiken.js";
import { AIKEN_EXAMPLE_SOURCES } from "./aikenExamples.js";

// Example sources
export const EXAMPLE_SOURCES: KnowledgeSourceSpec[] = [
  ...AWESOME_AIKEN_EXAMPLE_SOURCES,
  ...AIKEN_EXAMPLE_SOURCES
];

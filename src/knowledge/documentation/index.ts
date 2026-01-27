/**
 * Documentation knowledge sources.
 * Re-exports all documentation-related knowledge paths.
 */

export * from "./aikenSite.js";
export * from "./evolutionDocs.js";

import { KnowledgeSourceSpec } from "../types.js";
import { AIKEN_SITE_SOURCES } from "./aikenSite.js";
import { EVOLUTION_DOCS_SOURCES } from "./evolutionDocs.js";

/**
 * All documentation knowledge sources combined.
 */
export const DOCUMENTATION_SOURCES: KnowledgeSourceSpec[] = [
  ...AIKEN_SITE_SOURCES,
  ...EVOLUTION_DOCS_SOURCES,
];

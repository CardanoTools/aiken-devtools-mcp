/**
 * Documentation knowledge sources.
 * Re-exports all documentation-related knowledge paths.
 */

export * from "./aikenSite.js";
export * from "./evolutionDocs.js";
export * from "./assistDocs.js";
export * from "../awesome/awesomeAiken.js";

import { KnowledgeSourceSpec } from "../types.js";
import { AIKEN_SITE_SOURCES } from "./aikenSite.js";
import { EVOLUTION_DOCS_SOURCES } from "./evolutionDocs.js";
import { ASSIST_DOCS_SOURCES } from "./assistDocs.js";
import { AWESOME_AIKEN_DOCUMENTATION_SOURCES } from "../awesome/awesomeAiken.js";

/**
 * All documentation knowledge sources combined.
 */
export const DOCUMENTATION_SOURCES: KnowledgeSourceSpec[] = [
  ...AIKEN_SITE_SOURCES,
  ...EVOLUTION_DOCS_SOURCES,
  ...ASSIST_DOCS_SOURCES,
  ...AWESOME_AIKEN_DOCUMENTATION_SOURCES,
];

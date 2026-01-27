/**
 * Central registry for all knowledge sources.
 * Aggregates documentation, library, and example sources.
 */

import { KnowledgeSourceSpec, KnowledgeSource } from "./types.js";
import { DOCUMENTATION_SOURCES } from "./documentation/index.js";
import { LIBRARY_SOURCES } from "./libraries/index.js";
import { EXAMPLE_SOURCES } from "./examples/index.js";

export const ALL_KNOWLEDGE_SOURCES: KnowledgeSourceSpec[] = [
  ...DOCUMENTATION_SOURCES,
  ...LIBRARY_SOURCES,
  ...EXAMPLE_SOURCES,
];

export function findSpecById(id: KnowledgeSource): KnowledgeSourceSpec | undefined {
  return ALL_KNOWLEDGE_SOURCES.find(s => s.id === id);
}

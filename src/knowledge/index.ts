/**
 * Central registry for all knowledge sources.
 * Organized by importance and usage patterns.
 */

import { KnowledgeSourceSpec, KnowledgeSource } from "./core/types.js";
import { ALL_SOURCES, SCOPE_PRESETS } from "./core/sources.js";

export const ALL_KNOWLEDGE_SOURCES: KnowledgeSourceSpec[] = ALL_SOURCES;

export function findSpecById(id: KnowledgeSource): KnowledgeSourceSpec | undefined {
  return ALL_KNOWLEDGE_SOURCES.find(s => s.id === id);
}

export function resolveScopePreset(scope: string): string[] {
  if (scope in SCOPE_PRESETS) {
    return SCOPE_PRESETS[scope as keyof typeof SCOPE_PRESETS];
  }
  return [scope]; // Individual source ID
}

// Legacy exports for backward compatibility
export { CORE_SOURCES, EXTENDED_SOURCES, COMMUNITY_SOURCES } from "./core/sources.js";

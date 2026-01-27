/**
 * Curated knowledge sources for Aiken development.
 * Token-optimized and organized by importance.
 */

import { KnowledgeSourceSpec } from "./types.js";

// Core sources - always available, most important
export const CORE_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "fundamentals",
    remoteUrl: "https://github.com/aiken-lang/site.git",
    defaultRef: "main",
    folderName: "aiken-site",
    subPath: "src/pages/fundamentals",
    description: "Core concepts: getting started, installation, project structure, troubleshooting",
    category: "documentation",
  },
  {
    id: "language-tour",
    remoteUrl: "https://github.com/aiken-lang/site.git",
    defaultRef: "main",
    folderName: "aiken-site",
    subPath: "src/pages/language-tour.mdx",
    description: "Language syntax: types, functions, pattern matching, modules, tests",
    category: "documentation",
  },
  {
    id: "stdlib",
    remoteUrl: "https://github.com/aiken-lang/stdlib.git",
    defaultRef: "main",
    folderName: "aiken-stdlib",
    description: "Standard library: collections, crypto, math, Cardano utilities",
    category: "library",
  },
  {
    id: "prelude",
    remoteUrl: "https://github.com/aiken-lang/prelude.git",
    defaultRef: "main",
    folderName: "aiken-prelude",
    description: "Core types: Bool, Int, ByteArray, List, Option, Dict",
    category: "library",
  },
];

// Extended sources - require sync, commonly used
export const EXTENDED_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "examples",
    remoteUrl: "https://github.com/aiken-lang/site.git",
    defaultRef: "main",
    folderName: "aiken-site",
    subPath: "src/pages/example--hello-world",
    description: "Hello world example: step-by-step smart contract tutorial",
    category: "example",
  },
  {
    id: "vesting-example",
    remoteUrl: "https://github.com/aiken-lang/site.git",
    defaultRef: "main",
    folderName: "aiken-site",
    subPath: "src/pages/example--vesting",
    description: "Vesting contract: time-locked funds with multiple beneficiaries",
    category: "example",
  },
  {
    id: "evolution-sdk",
    remoteUrl: "https://github.com/lucid-evolution/lucid-evolution.git",
    defaultRef: "main",
    folderName: "lucid-evolution",
    subPath: "src",
    description: "Lucid Evolution SDK: Cardano transaction building and utilities",
    category: "library",
  },
  {
    id: "uplc-reference",
    remoteUrl: "https://github.com/aiken-lang/site.git",
    defaultRef: "main",
    folderName: "aiken-site",
    subPath: "src/pages/uplc",
    description: "Untyped Plutus Core: low-level smart contract execution model",
    category: "documentation",
  },
];

// Community sources - user-curated
export const COMMUNITY_SOURCES: KnowledgeSourceSpec[] = [
  // Add community sources here via aiken_knowledge_add
];

// All sources combined
export const ALL_SOURCES = [
  ...CORE_SOURCES,
  ...EXTENDED_SOURCES,
  ...COMMUNITY_SOURCES,
];

// Convenient scope mappings
export const SCOPE_PRESETS = {
  core: CORE_SOURCES.map(s => s.id),
  extended: EXTENDED_SOURCES.map(s => s.id),
  examples: EXTENDED_SOURCES.filter(s => s.category === "example").map(s => s.id),
  libraries: [...CORE_SOURCES, ...EXTENDED_SOURCES].filter(s => s.category === "library").map(s => s.id),
  docs: [...CORE_SOURCES, ...EXTENDED_SOURCES].filter(s => s.category === "documentation").map(s => s.id),
} as const;

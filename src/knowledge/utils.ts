/**
 * Utility functions for knowledge sources.
 */

import path from "node:path";
import os from "node:os";
import { KnowledgeSourceSpec } from "./types.js";

const CACHE_FOLDER = ".aiken-devtools-cache";

/**
 * Get the base cache directory for all knowledge sources (workspace-local).
 */
export function getCacheBaseDir(): string {
  // Keep cache within the workspace to allow search tools to read cached files safely.
  return path.join(process.cwd(), CACHE_FOLDER);
}

/**
 * Get the local directory path where a repository's clone lives.
 * This is the base path for the git clone, before any subPath is applied.
 */
export function resolveRepoBaseDirPath(spec: KnowledgeSourceSpec): string {
  return path.join(getCacheBaseDir(), spec.folderName);
}

/**
 * Resolve the full local directory path for a knowledge source.
 * If the source has a subPath, it will be appended to the repo base directory.
 */
export function resolveSourceDirPath(spec: KnowledgeSourceSpec): string {
  const base = resolveRepoBaseDirPath(spec);
  if (spec.subPath) {
    return path.join(base, spec.subPath);
  }
  return base;
}

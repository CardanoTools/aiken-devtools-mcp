/**
 * Shared types for knowledge sources.
 */

/**
 * Knowledge source identifiers.
 * Use a generic string type to allow many dynamic sources (e.g., auto-imported lists).
 */
export type KnowledgeSource = string;

export type KnowledgeSourceSpec = {
  /** Unique identifier for this knowledge source */
  id: KnowledgeSource;
  /** Git repository URL */
  remoteUrl: string;
  /** Git ref to checkout (branch/tag) */
  defaultRef: string;
  /** Local folder name in the cache directory */
  folderName: string;
  /** Subfolder within the repo to focus on (optional, for partial clones or search filtering) */
  subPath?: string;
  /** Human-readable description of what this knowledge source contains */
  description: string;
  /** Category for grouping (documentation, library, example) */
  category: "documentation" | "library" | "example";
};

/** Legacy alias for backward compatibility */
export type KnowledgeRepo = KnowledgeSource;

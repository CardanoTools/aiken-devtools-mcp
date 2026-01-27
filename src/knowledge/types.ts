/**
 * Shared types for knowledge sources.
 */

/**
 * Knowledge source identifiers.
 * Multiple sources can come from the same git repository but different subfolders.
 */
export type KnowledgeSource =
  // Aiken stdlib - utility modules
  | "stdlib"
  | "stdlib-aiken"
  | "stdlib-cardano"
  // Aiken prelude - core built-ins
  | "prelude"
  // Aiken site documentation sections
  | "site-fundamentals"
  | "site-language-tour"
  | "site-installation-instructions"
  | "site-hello-world"
  | "site-vesting"
  | "site-uplc"
  // Evolution SDK - TypeScript Cardano SDK
  | "evolution-sdk"
  | "evolution-docs"
  | "evolution-docs-addresses"
  | "evolution-docs-transactions"
  | "evolution-docs-wallets"
  | "evolution-docs-providers"
  | "evolution-docs-smart-contracts"
  | "evolution-docs-devnet"
  | "evolution-src";

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

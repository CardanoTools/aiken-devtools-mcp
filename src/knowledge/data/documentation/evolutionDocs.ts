/**
 * Lucid Evolution SDK documentation.
 * Contains guides for addresses, transactions, wallets, providers, smart contracts, and devnet.
 */

import { KnowledgeSourceSpec } from "../core/types.js";

const EVOLUTION_SDK_URL = "https://github.com/Anastasia-Labs/lucid-evolution.git";
const EVOLUTION_SDK_REF = "main";
const EVOLUTION_SDK_FOLDER = "lucid-evolution";

export const EVOLUTION_DOCS_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "evolution-docs",
    remoteUrl: EVOLUTION_SDK_URL,
    defaultRef: EVOLUTION_SDK_REF,
    folderName: EVOLUTION_SDK_FOLDER,
    subPath: "docs",
    description: "Lucid Evolution SDK documentation root: guides, tutorials, API docs",
    category: "documentation",
  },
  {
    id: "evolution-docs-addresses",
    remoteUrl: EVOLUTION_SDK_URL,
    defaultRef: EVOLUTION_SDK_REF,
    folderName: EVOLUTION_SDK_FOLDER,
    subPath: "docs/pages/documentation/deep-dives/addresses",
    description: "Lucid Evolution addresses documentation: address generation, derivation, encoding",
    category: "documentation",
  },
  {
    id: "evolution-docs-transactions",
    remoteUrl: EVOLUTION_SDK_URL,
    defaultRef: EVOLUTION_SDK_REF,
    folderName: EVOLUTION_SDK_FOLDER,
    subPath: "docs/pages/documentation/deep-dives/transactions",
    description: "Lucid Evolution transactions documentation: building, signing, submitting transactions",
    category: "documentation",
  },
  {
    id: "evolution-docs-wallets",
    remoteUrl: EVOLUTION_SDK_URL,
    defaultRef: EVOLUTION_SDK_REF,
    folderName: EVOLUTION_SDK_FOLDER,
    subPath: "docs/pages/documentation/deep-dives/wallets",
    description: "Lucid Evolution wallets documentation: wallet types, key management, signing",
    category: "documentation",
  },
  {
    id: "evolution-docs-providers",
    remoteUrl: EVOLUTION_SDK_URL,
    defaultRef: EVOLUTION_SDK_REF,
    folderName: EVOLUTION_SDK_FOLDER,
    subPath: "docs/pages/documentation/core-concepts/providers",
    description: "Lucid Evolution providers documentation: Blockfrost, Kupmios, Ogmios, emulator",
    category: "documentation",
  },
  {
    id: "evolution-docs-smart-contracts",
    remoteUrl: EVOLUTION_SDK_URL,
    defaultRef: EVOLUTION_SDK_REF,
    folderName: EVOLUTION_SDK_FOLDER,
    subPath: "docs/pages/documentation/deep-dives/smart-contracts",
    description: "Lucid Evolution smart contracts documentation: validators, minting policies, script contexts",
    category: "documentation",
  },
  {
    id: "evolution-docs-devnet",
    remoteUrl: EVOLUTION_SDK_URL,
    defaultRef: EVOLUTION_SDK_REF,
    folderName: EVOLUTION_SDK_FOLDER,
    subPath: "docs/pages/documentation/deep-dives/devnet",
    description: "Lucid Evolution devnet documentation: local development network setup and usage",
    category: "documentation",
  },
];

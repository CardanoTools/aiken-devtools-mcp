/**
 * Lucid Evolution SDK source code.
 * TypeScript SDK for building Cardano transactions and interacting with smart contracts.
 */

import { KnowledgeSourceSpec } from "../types.js";

const EVOLUTION_SDK_URL = "https://github.com/Anastasia-Labs/lucid-evolution.git";
const EVOLUTION_SDK_REF = "main";
const EVOLUTION_SDK_FOLDER = "lucid-evolution";

export const EVOLUTION_SDK_SOURCES: KnowledgeSourceSpec[] = [
  {
    id: "evolution-sdk",
    remoteUrl: EVOLUTION_SDK_URL,
    defaultRef: EVOLUTION_SDK_REF,
    folderName: EVOLUTION_SDK_FOLDER,
    subPath: "packages/lucid",
    description: "Lucid Evolution main SDK package: high-level API for Cardano transactions",
    category: "library",
  },
  {
    id: "evolution-src",
    remoteUrl: EVOLUTION_SDK_URL,
    defaultRef: EVOLUTION_SDK_REF,
    folderName: EVOLUTION_SDK_FOLDER,
    subPath: "packages/lucid/src",
    description: "Lucid Evolution SDK source code: internal implementation details",
    category: "library",
  },
];

import { KnowledgeSourceSpec } from "./types.js";
import { ALL_KNOWLEDGE_SOURCES } from "../index.js";

export type CompactSpec = {
  id: string;
  category: KnowledgeSourceSpec['category'];
  folderName: string;
  subPath?: string;
  remoteHost?: string;
};

export function compactSpec(spec: KnowledgeSourceSpec): CompactSpec {
  let remoteHost: string | undefined;
  try {
    const url = new URL(spec.remoteUrl);
    remoteHost = url.host;
  } catch {
    // ignore non-URL remotes (sites, etc.)
  }

  return {
    id: spec.id,
    category: spec.category,
    folderName: spec.folderName,
    subPath: spec.subPath,
    remoteHost
  };
}

export function compactAll(): CompactSpec[] {
  return ALL_KNOWLEDGE_SOURCES.map(compactSpec);
}

export function findSpecById(id: string): KnowledgeSourceSpec | undefined {
  return ALL_KNOWLEDGE_SOURCES.find((s) => s.id === id);
}

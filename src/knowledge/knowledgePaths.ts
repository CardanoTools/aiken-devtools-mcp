import path from "node:path";

import { resolveWorkspacePath } from "../aiken/runAiken";

export const KNOWLEDGE_CACHE_DIRNAME = ".aiken-devtools-cache";

export type KnowledgeRepo = "stdlib" | "prelude" | "evolution-sdk";

export type KnowledgeRepoSpec = {
  repo: KnowledgeRepo;
  remoteUrl: string;
  defaultRef: string;
  folderName: string;
};

export const KNOWLEDGE_REPOS: Record<KnowledgeRepo, KnowledgeRepoSpec> = {
  stdlib: {
    repo: "stdlib",
    remoteUrl: "https://github.com/aiken-lang/stdlib.git",
    defaultRef: "main",
    folderName: "stdlib"
  },
  prelude: {
    repo: "prelude",
    remoteUrl: "https://github.com/aiken-lang/prelude.git",
    defaultRef: "main",
    folderName: "prelude"
  },
  "evolution-sdk": {
    repo: "evolution-sdk",
    remoteUrl: "https://github.com/IntersectMBO/evolution-sdk.git",
    defaultRef: "main",
    folderName: "evolution-sdk"
  }
};

export function getWorkspaceRoot(): string {
  return process.cwd();
}

export function resolveCacheDirPath(): string {
  const workspaceRoot = getWorkspaceRoot();
  return resolveWorkspacePath(workspaceRoot, path.join(workspaceRoot, KNOWLEDGE_CACHE_DIRNAME));
}

export function resolveRepoDirPath(repo: KnowledgeRepo): string {
  const workspaceRoot = getWorkspaceRoot();
  const cacheDir = resolveCacheDirPath();
  return resolveWorkspacePath(workspaceRoot, path.join(cacheDir, KNOWLEDGE_REPOS[repo].folderName));
}

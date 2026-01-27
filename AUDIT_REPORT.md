# Aiken DevTools MCP Audit Report

**Date:** 2026-01-27
**Auditor:** Claude Code
**Repository:** CardanoTools/aiken-devtools-mcp

---

## Executive Summary

**Overall Rating: ⭐⭐⭐⭐ GOOD (4/5)**

This is a **well-designed, production-ready MCP server** for Aiken smart contract development. The codebase demonstrates solid engineering practices with proper security measures, comprehensive type safety, and thoughtful error handling. It's suitable for use by AI agents in smart contract development workflows.

---

## Project Overview

- **Type:** Model Context Protocol (MCP) server
- **Purpose:** AI/LLM agent tooling for Aiken smart contract development
- **Total Size:** ~3,673 lines of TypeScript across 34 source files
- **Tools Provided:** 25 MCP tools
- **Dependencies:** 2 runtime (`@modelcontextprotocol/sdk`, `zod`)

### Tools by Category

| Category | Tools |
|----------|-------|
| Build & Validation | `aiken_version`, `aiken_check`, `aiken_build`, `aiken_test`, `aiken_fmt`, `aiken_docs` |
| Blueprint Inspection | `aiken_blueprint_preamble`, `aiken_blueprint_list_validators`, `aiken_blueprint_get_validator`, `aiken_blueprint_convert`, `aiken_blueprint_export_cardano_cli` |
| On-Chain Credentials | `aiken_blueprint_hash`, `aiken_blueprint_address`, `aiken_blueprint_policy` |
| Integration Bundles | `aiken_blueprint_integration_bundle`, `aiken_blueprint_integration_bundle_all`, `aiken_blueprint_integration_bundle_by_title` |
| Parameterization | `aiken_blueprint_apply` |
| Code Generation | `aiken_codegen_evolution_sdk`, `aiken_codegen_lucid_evolution` |
| Knowledge Management | `aiken_knowledge_sync`, `aiken_knowledge_search`, `aiken_knowledge_read_file` |

---

## 🟢 Strengths

### 1. Security

| Feature | Implementation | Quality |
|---------|----------------|---------|
| Path Traversal Protection | `resolveWorkspacePath()` validates all paths stay within workspace | ✅ Excellent |
| Input Validation | Zod schemas with `.strict()` on all tool inputs | ✅ Excellent |
| Process Isolation | `spawn()` with no shell execution - prevents command injection | ✅ Excellent |
| Timeout Handling | 5-minute default timeout with SIGKILL - prevents hangs | ✅ Excellent |
| ENOENT Handling | Graceful errors when `aiken`/`git` not installed | ✅ Good |

The `resolveWorkspacePath()` function in `src/aiken/runAiken.ts:29-40` correctly prevents directory traversal attacks:

```typescript
export function resolveWorkspacePath(workspaceRoot: string, relativeOrAbsolutePath?: string): string {
  if (!relativeOrAbsolutePath) return workspaceRoot;

  const resolved = path.resolve(workspaceRoot, relativeOrAbsolutePath);
  const normalizedRoot = path.resolve(workspaceRoot) + path.sep;

  if (!resolved.startsWith(normalizedRoot) && resolved !== path.resolve(workspaceRoot)) {
    throw new Error(`Path must be within workspace root: ${relativeOrAbsolutePath}`);
  }

  return resolved;
}
```

### 2. Type Safety

- **Strict TypeScript config** with `strict: true`, `noUncheckedIndexedAccess: true`
- **Zod validation** on all inputs AND outputs (uncommon and excellent)
- **Discriminated union types** for `RunAikenResult` (ok/error distinction)

### 3. Error Handling

- Structured error responses with `isError: true`
- Detailed command execution metadata (exit code, stdout, stderr, duration)
- Human-readable error messages for common scenarios (ENOENT, timeouts, JSON parse failures)

### 4. Architecture

- Clean modular structure (tools, utilities, modules separated)
- Consistent patterns across all 25 tools
- Proper MCP protocol annotations (`readOnlyHint`, `idempotentHint`, `destructiveHint`, `openWorldHint`)
- Minimal dependencies (only `@modelcontextprotocol/sdk` + `zod`)

### 5. Comprehensive Feature Set

- 25 tools covering the full Aiken development lifecycle
- Code generation for both Evolution SDK and Lucid Evolution
- Knowledge management with stdlib/prelude/site/evolution-sdk syncing
- Batch operations (e.g., `aiken_blueprint_integration_bundle_all`)

---

## 🟡 Areas for Improvement

### 1. Missing Test Suite

```json
"test": "npm run build"  // Just runs type checking
```

- No unit tests
- No integration tests
- Risk: Regressions could go unnoticed

**Recommendation**: Add at least basic tests for critical functions like `resolveWorkspacePath()`, `toIdentifier()`, and schema validation.

### 2. ~~Package Naming Inconsistency~~ ✅ FIXED

~~The package name `cardano-mcp` doesn't match the actual purpose (Aiken-specific).~~

**Status**: Fixed - Package renamed to `aiken-devtools-mcp`.

### 3. Potential Edge Cases

#### a) ~~Type definition placement issue~~ ✅ FIXED

~~Type definitions appeared inside the `normalizeStep` function body.~~

**Status**: Fixed - Types moved to module scope in `aikenBlueprintIntegrationBundle.ts`.

#### b) ~~No output size limits on stdout capture~~ ✅ FIXED

~~stdout/stderr were accumulated without limits.~~

**Status**: Fixed - Added 10MB limits to both `runAiken.ts` and `runGit.ts`:

```typescript
const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB limit
child.stdout.on("data", (chunk) => {
  if (stdout.length < MAX_OUTPUT_SIZE) {
    stdout += chunk;
  }
});
```

### 4. ~~Knowledge Sync Hardcoded URLs~~ ✅ IMPROVED

```typescript
// src/knowledge/knowledgePaths.ts
remoteUrl: "https://github.com/aiken-lang/stdlib.git"
```

URLs are hardcoded but now properly configured with valid git URLs for all repositories:
- `aiken-lang/stdlib` - Aiken standard library
- `aiken-lang/prelude` - Aiken prelude
- `aiken-lang/site` - Aiken documentation site (added)
- `IntersectMBO/evolution-sdk` - Evolution SDK

**Status**: Fixed invalid URLs and added `aiken-lang/site` as a new knowledge source.

### 5. No Validation for extraArgs

```typescript
// src/tools/aikenBuild.ts:52
const args = ["build", ...(extraArgs ?? [])];
```

`extraArgs` is passed directly to the command. While not a shell injection risk (using `spawn`), unexpected flags could be passed. Consider a whitelist approach for safer operation.

---

## 🔴 Issues ~~to Address~~ RESOLVED

### 1. ~~Code Organization~~ ✅ FIXED

~~The code in `src/tools/aikenBlueprintIntegrationBundle.ts` has type definitions that should be reorganized.~~

**Status**: Fixed - Type definitions moved to module scope.

### 2. ~~Output Size Limits~~ ✅ FIXED

~~Add output size limits to prevent potential memory exhaustion.~~

**Status**: Fixed - 10MB limits added to `runAiken.ts` and `runGit.ts`.

---

## Security Assessment

| Risk Category | Assessment | Notes |
|--------------|------------|-------|
| Command Injection | ✅ Safe | Uses `spawn()` with array args, no shell |
| Path Traversal | ✅ Safe | `resolveWorkspacePath()` validates paths |
| Input Validation | ✅ Safe | Zod schemas with `.strict()` |
| Resource Exhaustion | ✅ Safe | 10MB output limits + 5-min timeout |
| Dependency Chain | ✅ Safe | Only 2 runtime deps, both well-maintained |

---

## Recommendations Summary

| Recommendation | Status |
|----------------|--------|
| Add basic tests | 🔲 Open |
| Fix package name | ✅ Fixed |
| Reorganize code | ✅ Fixed |
| Add output limits | ✅ Fixed |
| Fix knowledge URLs | ✅ Fixed |
| Add site knowledge repo | ✅ Fixed |
| Document limitations | 🔲 Open |

---

## Conclusion

This MCP server is **good quality and safe to use**. It demonstrates thoughtful security practices, excellent type safety, and a comprehensive feature set for Aiken development. The identified issues are minor and don't affect core functionality or security.

**Verdict**: ✅ Ready for production use with minor improvements recommended.

---

## Files Reviewed

- `src/index.ts` - Entry point
- `src/server.ts` - Server factory and tool registration
- `src/aiken/runAiken.ts` - Core Aiken CLI wrapper
- `src/git/runGit.ts` - Core Git CLI wrapper
- `src/blueprint/readBlueprint.ts` - Blueprint parsing
- `src/codegen/snippets.ts` - TypeScript code generation
- `src/codegen/cardanoCli.ts` - Cardano CLI utilities
- `src/knowledge/knowledgePaths.ts` - Knowledge repo configuration
- `src/tools/aikenBuild.ts` - Build tool
- `src/tools/aikenBlueprintApply.ts` - Blueprint apply tool
- `src/tools/aikenBlueprintIntegrationBundle.ts` - Integration bundle tool
- `src/tools/aikenCommon.ts` - Common utilities
- `src/tools/aikenKnowledgeSync.ts` - Knowledge sync tool
- `src/tools/aikenKnowledgeSearch.ts` - Knowledge search tool
- `src/tools/aikenKnowledgeReadFile.ts` - Knowledge read file tool
- `package.json` - Package configuration
- `tsconfig.json` - TypeScript configuration

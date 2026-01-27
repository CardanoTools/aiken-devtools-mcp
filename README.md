# aiken-devtools-mcp

MCP (Model Context Protocol) tools for coding agents to understand, develop, and integrate Aiken smart contracts.

## Development

- Install deps: `npm install`
- Build: `npm run build`
- Run (stdio MCP server): `npm start`

Running with policy & audit
- The server runs in **readonly** mode by default to be safe. Use `--no-readonly` to disable readonly mode and `--allow-tools` to explicitly allow specific tools (e.g., `--allow-tools aiken_knowledge_add`).
- A tool manifest is provided in `mcp-tools.json` and an administrator policy file `mcp-policy.json` can be used to restrict tools. Tool calls are recorded to `audit.log` (sensitive fields are redacted).
- Use `npx aiken-devtools-mcp --allow-tools aiken_knowledge_add` to run the server with an explicit allowlist for selected destructive tools.

## MCP tools

### Aiken CLI Tools
- `aiken_version`: returns the installed `aiken` CLI version (errors if `aiken` is not on `PATH`).
- `aiken_check`: runs `aiken check`.
- `aiken_build`: runs `aiken build` (writes artifacts).
- `aiken_test`: runs `aiken test`.
- `aiken_fmt`: runs `aiken fmt` (formats sources).
- `aiken_docs`: runs `aiken docs` (generates docs).
- `aiken_new`: creates a new Aiken project with `aiken new`.

### Blueprint Tools
- `aiken_blueprint_preamble`: reads `plutus.json` (or custom blueprint path) and returns the blueprint preamble + basic counts.
- `aiken_blueprint_list_validators`: reads `plutus.json` and lists validators with metadata (optionally includes compiled code). Also returns inferred `module` and `validator` names when the title matches `module.validator`.
- `aiken_blueprint_get_validator`: reads `plutus.json` and returns a single validator entry by title or index.
- `aiken_blueprint_hash`: runs `aiken blueprint hash` to compute a validator payment credential hash (hex).
- `aiken_blueprint_address`: runs `aiken blueprint address` to compute a spending validator address (bech32).
- `aiken_blueprint_policy`: runs `aiken blueprint policy` to compute a minting policy ID.
- `aiken_blueprint_convert`: runs `aiken blueprint convert` to produce a `cardano-cli` script JSON (includes `cborHex`).
- `aiken_blueprint_export_cardano_cli`: runs `aiken blueprint convert --to cardano-cli`, parses JSON, and optionally writes it to a file.
- `aiken_blueprint_integration_bundle`: computes `hash` + `address` + `policyId` (and optionally parses `cardano-cli` JSON + returns Evolution SDK/Lucid snippets) for a single validator.
- `aiken_blueprint_integration_bundle_all`: computes the same bundle for every validator in the blueprint, with optional per-validator outputs (cardano-cli JSON and snippets).
- `aiken_blueprint_integration_bundle_by_title`: computes the bundle for a validator selected by its blueprint title (no need to provide module/validator).
- `aiken_blueprint_apply`: runs `aiken blueprint apply` (non-interactive; requires parameter CBOR hex). Optionally writes an output blueprint via `--out`.

### Knowledge Tools
- `aiken_knowledge_sync`: clones/updates knowledge sources into `.aiken-devtools-cache/` (so agents can search them). Sources include:
  - **Aiken stdlib**: `stdlib`, `stdlib-aiken` (collections, crypto, math), `stdlib-cardano` (addresses, assets, transactions)
  - **Aiken prelude**: `prelude` (core built-in types: Bool, Int, ByteArray, List, Option)
  - **Aiken site docs**: `site-fundamentals` (eUTxO, patterns), `site-language-tour` (syntax, types), `site-hello-world`, `site-vesting`, `site-uplc`
  - **Evolution SDK**: `evolution-sdk`, `evolution-docs`, `evolution-docs-addresses`, `evolution-docs-transactions`, `evolution-docs-wallets`, `evolution-docs-providers`, `evolution-docs-smart-contracts`, `evolution-docs-devnet`, `evolution-src`
  - **Tip:** pass `{ "compact": true }` to `aiken_knowledge_sync` to return minimal results (no stdout/stderr) and reduce token usage.
- `aiken_knowledge_search`: searches across project + cached knowledge sources. Scopes include:
  - `project` - current workspace
  - `stdlib`, `stdlib-aiken`, `stdlib-cardano` - Aiken standard library
  - `prelude` - Aiken prelude
  - `site-fundamentals`, `site-language-tour`, `site-hello-world`, `site-vesting`, `site-uplc`, `site-all` - Aiken documentation
  - `evolution-sdk`, `evolution-docs`, `evolution-docs-*`, `evolution-src`, `evolution-all` - Evolution SDK
  - `all` - search everything
- `aiken_knowledge_list`: list known knowledge sources. Returns a compact list by default (id, category, folderName, subPath, remoteHost). Use `include: "full"` to return full specs. Supports filtering by `ids`, `category`, or `query`.
- `aiken_knowledge_add`: add a new knowledge source programmatically. Input: `{ remoteUrl, category?, subPath?, description?, defaultRef?, folderName?, commit?, runSync? }`. This will write into `src/knowledge/<category>/customAdded.ts`, update the category index, and (optionally) commit the change for you.
- `aiken_knowledge_read_file`: reads a file from the workspace (including cached knowledge sources) by line range.
- `aiken_knowledge_ingest`: ingests a single knowledge source into the vector store.
- `aiken_knowledge_bulk_ingest`: ingests multiple knowledge sources into the vector store.
- `aiken_knowledge_proposals_list`: lists proposed knowledge sources that can be ingested.
- `aiken_knowledge_approve`: approves and ingests proposed knowledge sources.
- `aiken_knowledge_index`: indexes the vector store for search.

### Codegen Tools
- `aiken_codegen_lucid_evolution`: generates a TypeScript snippet for `@lucid-evolution/lucid` from a validator (via `aiken blueprint convert --to cardano-cli`).
- `aiken_codegen_evolution_sdk`: (preferred) generates a TypeScript snippet using `@evolution-sdk/evolution` packages from `IntersectMBO/evolution-sdk`.

### Discovery Tools
- `aiken_server_manifest`: returns the server's manifest (tools, prompts, resources).
- `aiken_tools_catalog`: returns a categorized list of tools (the server also exposes `mcp-tools.json` via a resource). Hosts can use this to present tools grouped by feature area (project, blueprint, knowledge, codegen, discovery).
- `aiken_tool_search`: searches the local manifest for tools matching a query.

### Toolset Tools
- `aiken_toolsets_enable`: enables/disables toolsets at runtime.
- `aiken_toolsets_list`: lists available/active toolsets.

## Tool Discovery & Configuration

### Tool Discovery
- Run `aiken_tools_catalog` to get a categorized list of tools (the server also exposes `mcp-tools.json` via a resource). Hosts can use this to present tools grouped by feature area (project, blueprint, knowledge, codegen, discovery).
- Use the CLI `scripts/tool-search.js` (or `node scripts/tool-search.js <query>`) to search the local manifest quickly. The MCP tool `aiken_tool_search` provides the same search functionality via MCP calls.

### Toolsets & Dynamic Configuration
- Start the server with `--toolsets <csv>` to enable named toolsets (e.g., `--toolsets project,knowledge`). You can also set `AIKEN_TOOLSETS` env var for the same effect.
- Enable `--dynamic-toolsets` to allow runtime enabling/disabling of toolsets. When enabled, use `aiken_toolsets_enable` to toggle toolsets and `aiken_toolsets_list` to inspect available/active sets.
- Lockdown mode (`--lockdown`) disables network-related tools to reduce exposure in sensitive environments. Insiders mode (`--insiders`) enables experimental tools that are hidden by default.

## MCP prompts

- `aiken_validator_template`: Provides a basic template for writing an Aiken validator.
- `aiken_development_tips`: Offers tips for Aiken smart contract development.

## MCP resources

- `mcp_tools_manifest`: The JSON manifest of all available tools.

## Recommended workflow

1) Build artifacts: run `aiken_build`.
2) Inspect blueprint: use `aiken_blueprint_list_validators` (read module/validator) or `aiken_blueprint_get_validator` (inspect one entry).
3) Integration outputs: use `aiken_blueprint_integration_bundle` (single), `aiken_blueprint_integration_bundle_by_title` (by blueprint title), or `aiken_blueprint_integration_bundle_all` (all validators).
4) App codegen: use `aiken_codegen_evolution_sdk` (preferred) or `aiken_codegen_lucid_evolution`.

## Examples

### Integration bundle (with Evolution SDK snippet)

Request (tool input):

```
{
	"projectDir": ".",
	"module": "my_project.validators",
	"validator": "escrow",
	"includeEvolutionSdkSnippet": true,
	"evolutionNetworkId": 0,
	"evolutionOutputPath": "artifacts/escrow.evolution.ts"
}
```

Returns structured output including `hash`, `address`, `policyId`, and `evolutionSdkSnippetTs`.

### Integration bundle (by title)

Request (tool input):

```
{
	"projectDir": ".",
	"blueprintPath": "plutus.json",
	"title": "my_project.validators.escrow",
	"includeEvolutionSdkSnippet": true
}
```

Returns `bundle` with the same structure as `aiken_blueprint_integration_bundle`.

### Integration bundle (all validators)

Request (tool input):

```
{
	"projectDir": ".",
	"blueprintPath": "plutus.json",
	"includeEvolutionSdkSnippet": true,
	"evolutionOutputDir": "artifacts/snippets"
}
```

Returns `results[]` entries containing per-validator `hash`, `address`, `policyId`, plus optional `evolutionSdkSnippetTs` and `writtenEvolutionSnippetFile`.

### Knowledge search (stdlib/prelude/evolution-sdk)

Request (tool input):

```
{
	"query": "ScriptHash.fromScript",
	"scope": "evolution-sdk"
}
```

Returns matching file paths + line snippets from the cached knowledge repos.

### Codegen (preferred, Evolution SDK)

Request (tool input):

```
{
	"projectDir": ".",
	"module": "my_project.validators",
	"validator": "escrow",
	"networkId": 0
}
```

Returns `snippetTs` and parsed `cardanoCliScript`.

---

## Importing Awesome Aiken (automated)

We've added a small importer script that fetches the curated list from the Awesome Aiken README and turns links into knowledge sources (documentation, libraries, examples).

- Run: `npm run import:awesome`
- What it does: downloads `https://raw.githubusercontent.com/aiken-lang/awesome-aiken/main/README.md`, parses links, and emits `src/knowledge/awesome/awesomeAiken.ts` (generated).
- After running, update the repository's cache with: `npx mcp run aiken_knowledge_sync` (or use the MCP tool UI) to clone or update the newly added sources.

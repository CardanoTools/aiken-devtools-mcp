# aiken-devtools-mcp

MCP (Model Context Protocol) tools for coding agents to understand, develop, and integrate Aiken smart contracts.

## Development

- Install deps: `npm install`
- Build: `npm run build`
- Run (stdio MCP server): `npm start`

## MCP tools (current)

- `aiken_version`: returns the installed `aiken` CLI version (errors if `aiken` is not on `PATH`).
- `aiken_check`: runs `aiken check`.
- `aiken_build`: runs `aiken build` (writes artifacts).
- `aiken_test`: runs `aiken test`.
- `aiken_fmt`: runs `aiken fmt` (formats sources).
- `aiken_docs`: runs `aiken docs` (generates docs).
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

New knowledge tools:
- `aiken_knowledge_list`: list known knowledge sources. Returns a compact list by default (id, category, folderName, subPath, remoteHost). Use `include: "full"` to return full specs. Supports filtering by `ids`, `category`, or `query`.
- `aiken_knowledge_add`: add a new knowledge source programmatically. Input: `{ remoteUrl, category?, subPath?, description?, defaultRef?, folderName?, commit?, runSync? }`. This will write into `src/knowledge/<category>/customAdded.ts`, update the category index, and (optionally) commit the change for you.

- `aiken_knowledge_read_file`: reads a file from the workspace (including cached knowledge sources) by line range.
- `aiken_codegen_lucid_evolution`: generates a TypeScript snippet for `@lucid-evolution/lucid` from a validator (via `aiken blueprint convert --to cardano-cli`).
- `aiken_codegen_evolution_sdk`: (preferred) generates a TypeScript snippet using `@evolution-sdk/evolution` packages from `IntersectMBO/evolution-sdk`.

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

If you want, I can run the importer now and add more fine-grained sources or tune category mapping.

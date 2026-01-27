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
- `aiken_blueprint_list_validators`: reads `plutus.json` and lists validators with metadata (optionally includes compiled code).
- `aiken_blueprint_get_validator`: reads `plutus.json` and returns a single validator entry by title or index.
- `aiken_blueprint_hash`: runs `aiken blueprint hash` to compute a validator payment credential hash (hex).
- `aiken_blueprint_address`: runs `aiken blueprint address` to compute a spending validator address (bech32).
- `aiken_blueprint_policy`: runs `aiken blueprint policy` to compute a minting policy ID.
- `aiken_blueprint_convert`: runs `aiken blueprint convert` to produce a `cardano-cli` script JSON (includes `cborHex`).
- `aiken_blueprint_export_cardano_cli`: runs `aiken blueprint convert --to cardano-cli`, parses JSON, and optionally writes it to a file.
- `aiken_blueprint_integration_bundle`: computes `hash` + `address` + `policyId` (and optionally parses `cardano-cli` JSON) for a single validator.
- `aiken_blueprint_apply`: runs `aiken blueprint apply` (non-interactive; requires parameter CBOR hex). Optionally writes an output blueprint via `--out`.
- `aiken_knowledge_sync`: clones/updates `aiken-lang/stdlib`, `aiken-lang/prelude`, and `IntersectMBO/evolution-sdk` into `.aiken-devtools-cache/` (so agents can search them).
- `aiken_knowledge_search`: searches across project + cached stdlib/prelude sources for a string.
- `aiken_knowledge_read_file`: reads a file from the workspace (including cached stdlib/prelude) by line range.
- `aiken_codegen_lucid_evolution`: generates a TypeScript snippet for `@lucid-evolution/lucid` from a validator (via `aiken blueprint convert --to cardano-cli`).
- `aiken_codegen_evolution_sdk`: (preferred) generates a TypeScript snippet using `@evolution-sdk/evolution` packages from `IntersectMBO/evolution-sdk`.

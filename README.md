# aiken-devtools-mcp

Node.js server implementing Model Context Protocol (MCP) for Aiken smart contract development.

## Features

- Aiken CLI integration (build, test, format, docs)
- Blueprint analysis and integration bundle generation
- Knowledge base management with semantic search
- Code generation for Evolution SDK and Lucid
- Tool discovery and dynamic configuration
- Audit logging and policy enforcement

## Development

- Install deps: `npm install`
- Build: `npm run build`
- Run (stdio MCP server): `npm start`

Running with policy & audit
- The server runs in **readonly** mode by default to be safe. Use `--no-readonly` to disable readonly mode and `--allow-tools` to explicitly allow specific tools (e.g., `--allow-tools aiken_knowledge_add`).
- A tool manifest is provided in `mcp-tools.json` and an administrator policy file `mcp-policy.json` can be used to restrict tools. Tool calls are recorded to `audit.log` (sensitive fields are redacted).
- Use `npx aiken-devtools-mcp --allow-tools aiken_knowledge_add` to run the server with an explicit allowlist for selected destructive tools.

## API

### Tools

#### Aiken CLI Tools

- **aiken_version**
  - Returns the installed `aiken` CLI version
  - Errors if `aiken` is not on `PATH`
  - Input: None
  - Read-only

- **aiken_check**
  - Runs `aiken check` to validate project
  - Input: `projectDir` (string, optional)
  - Read-only

- **aiken_build**
  - Runs `aiken build` to compile the project
  - Input: `projectDir` (string, optional), `extraArgs` (string, optional)
  - Writes artifacts to disk

- **aiken_test**
  - Runs `aiken test` to execute test suite
  - Input: `projectDir` (string, optional), `extraArgs` (string, optional)
  - Read-only

- **aiken_fmt**
  - Runs `aiken fmt` to format source code
  - Input: `projectDir` (string, optional), `checkOnly` (boolean, optional), `extraArgs` (string, optional)
  - Modifies source files

- **aiken_docs**
  - Runs `aiken docs` to generate documentation
  - Input: `projectDir` (string, optional), `extraArgs` (string, optional)
  - Writes documentation files

- **aiken_new**
  - Creates a new Aiken project
  - Input: `name` (string), `projectDir` (string, optional), `template` (string, optional)
  - Creates project directory and files

#### Blueprint Tools

- **aiken_blueprint_preamble**
  - Reads blueprint preamble and basic counts
  - Input: `projectDir` (string, optional), `blueprintPath` (string, optional)
  - Read-only

- **aiken_blueprint_list_validators**
  - Lists validators with metadata
  - Input: `projectDir` (string, optional), `blueprintPath` (string, optional), `includeCompiledCode` (boolean, optional)
  - Read-only

- **aiken_blueprint_get_validator**
  - Returns a single validator entry
  - Input: `projectDir` (string, optional), `blueprintPath` (string, optional), `title` (string, optional), `index` (number, optional)
  - Read-only

- **aiken_blueprint_hash**
  - Computes validator payment credential hash
  - Input: `projectDir` (string, optional), `blueprintPath` (string, optional), `module` (string), `validator` (string), `timeoutMs` (number, optional)
  - Read-only

- **aiken_blueprint_address**
  - Computes spending validator address
  - Input: `projectDir` (string, optional), `blueprintPath` (string, optional), `module` (string), `validator` (string), `timeoutMs` (number, optional)
  - Read-only

- **aiken_blueprint_policy**
  - Computes minting policy ID
  - Input: `projectDir` (string, optional), `blueprintPath` (string, optional), `module` (string), `validator` (string), `timeoutMs` (number, optional)
  - Read-only

- **aiken_blueprint_convert**
  - Produces cardano-cli script JSON
  - Input: `projectDir` (string, optional), `blueprintPath` (string, optional), `module` (string), `validator` (string), `timeoutMs` (number, optional)
  - Read-only

- **aiken_blueprint_export_cardano_cli**
  - Exports cardano-cli script and optionally writes to file
  - Input: `projectDir` (string, optional), `blueprintPath` (string, optional), `module` (string), `validator` (string), `outputPath` (string, optional), `timeoutMs` (number, optional)
  - Optionally writes files

- **aiken_blueprint_integration_bundle**
  - Computes hash + address + policyId bundle for a validator
  - Input: Complex object with project/module/validator details, optional code generation flags
  - Read-only

- **aiken_blueprint_integration_bundle_all**
  - Computes integration bundle for all validators
  - Input: Complex object with blueprint details and per-validator options
  - Optionally writes files

- **aiken_blueprint_integration_bundle_by_title**
  - Computes bundle for validator selected by blueprint title
  - Input: `projectDir`, `blueprintPath`, `title`, plus optional generation flags
  - Read-only

- **aiken_blueprint_apply**
  - Applies blueprint with parameters
  - Input: `projectDir` (string, optional), `blueprintPath` (string, optional), `module` (string), `validator` (string), `cborHex` (string), `out` (string, optional), `timeoutMs` (number, optional)
  - Writes output blueprint

#### Knowledge Tools

- **aiken_knowledge_sync**
  - Clones/updates knowledge sources into cache
  - Input: `sources` (string[], optional), `ref` (string, optional), `timeoutMs` (number, optional), `compact` (boolean, optional)
  - Downloads and caches repositories

- **aiken_knowledge_search**
  - Searches across project and cached knowledge
  - Input: `query` (string), `scope` (string, optional), `maxResults` (number, optional), `maxFiles` (number, optional), `fileExtensions` (string[], optional)
  - Read-only

- **aiken_knowledge_list**
  - Lists known knowledge sources
  - Input: `ids` (string[], optional), `category` (string, optional), `query` (string, optional), `include` (string, optional)
  - Read-only

- **aiken_knowledge_add**
  - Adds a new knowledge source
  - Input: `remoteUrl` (string), plus optional metadata fields
  - Modifies knowledge registry

- **aiken_knowledge_read_file**
  - Reads file from workspace or cached knowledge
  - Input: `path` (string), `startLine` (number, optional), `endLine` (number, optional), `maxChars` (number, optional)
  - Read-only

- **aiken_knowledge_ingest**
  - Ingests knowledge source into vector store
  - Input: Complex object with URL and processing options
  - Modifies vector store

- **aiken_knowledge_bulk_ingest**
  - Ingests multiple knowledge sources
  - Input: `urls` (string[], optional), `gitUrls` (string[], optional), plus processing options
  - Modifies vector store

- **aiken_knowledge_proposals_list**
  - Lists proposed knowledge sources
  - Input: `query` (string, optional), `limit` (number, optional)
  - Read-only

- **aiken_knowledge_approve**
  - Approves and ingests proposed sources
  - Input: `id` (string), `commit` (boolean, optional), `archive` (boolean, optional), `category` (string, optional)
  - Modifies knowledge registry and vector store

- **aiken_knowledge_index**
  - Indexes vector store for search
  - Input: `proposalId` (string, optional), `sourceId` (string, optional), `collection` (string, optional), `chunkSize` (number, optional), `overlap` (number, optional)
  - Modifies vector store

#### Codegen Tools

- **aiken_codegen_lucid_evolution**
  - Generates TypeScript snippet for Lucid Evolution
  - Input: `projectDir` (string, optional), `module` (string), `validator` (string), plus output options
  - Read-only

- **aiken_codegen_evolution_sdk**
  - Generates TypeScript snippet for Evolution SDK (preferred)
  - Input: `projectDir` (string, optional), `module` (string), `validator` (string), `networkId` (number), `exportName` (string, optional), plus options
  - Read-only

#### Discovery Tools

- **aiken_server_manifest**
  - Returns server's manifest
  - Input: None
  - Read-only

- **aiken_tools_catalog**
  - Returns categorized list of tools
  - Input: None
  - Read-only

- **aiken_tool_search**
  - Searches local manifest for tools
  - Input: `query` (string), `maxResults` (number, optional)
  - Read-only

#### Toolset Tools

- **aiken_toolsets_enable**
  - Enables/disables toolsets at runtime
  - Input: `toolsets` (string[]), `enable` (boolean)
  - Modifies server configuration

- **aiken_toolsets_list**
  - Lists available/active toolsets
  - Input: None
  - Read-only

### Tool annotations (MCP hints)

This server sets [MCP ToolAnnotations](https://modelcontextprotocol.io/specification/2025-03-26/server/tools#toolannotations) on each tool so clients can distinguish read-only tools from write-capable tools and understand operation characteristics.

| Tool Category | Read-only | Idempotent | Destructive | Notes |
|---------------|-----------|------------|-------------|-------|
| **CLI Tools** | Most read-only | Varies | Some modify files | `aiken_fmt` modifies sources |
| **Blueprint Analysis** | Yes | Yes | No | Pure analysis |
| **Blueprint Generation** | Most | Yes | Some write files | Export tools write files |
| **Knowledge Search** | Yes | Yes | No | Pure search |
| **Knowledge Management** | No | No | Yes | Modifies cache/registry |
| **Codegen** | Yes | Yes | No | Pure generation |
| **Discovery** | Yes | Yes | No | Pure discovery |
| **Toolsets** | No | Yes | No | Runtime configuration |

### MCP prompts

- `aiken_validator_template`: Provides a basic template for writing an Aiken validator
- `aiken_development_tips`: Offers tips for Aiken smart contract development

### MCP resources

- `mcp_tools_manifest`: The JSON manifest of all available tools

## Tool Discovery & Configuration

### Tool Discovery
- Run `aiken_tools_catalog` to get a categorized list of tools (the server also exposes `mcp-tools.json` via a resource). Hosts can use this to present tools grouped by feature area (project, blueprint, knowledge, codegen, discovery).
- Use the CLI `scripts/tool-search.js` (or `node scripts/tool-search.js <query>`) to search the local manifest quickly. The MCP tool `aiken_tool_search` provides the same search functionality via MCP calls.

### Toolsets & Dynamic Configuration
- Start the server with `--toolsets <csv>` to enable named toolsets (e.g., `--toolsets project,knowledge`). You can also set `AIKEN_TOOLSETS` env var for the same effect.
- Enable `--dynamic-toolsets` to allow runtime enabling/disabling of toolsets. When enabled, use `aiken_toolsets_enable` to toggle toolsets and `aiken_toolsets_list` to inspect available/active sets.
- Lockdown mode (`--lockdown`) disables network-related tools to reduce exposure in sensitive environments. Insiders mode (`--insiders`) enables experimental tools that are hidden by default.

### Knowledge Management
The server maintains a comprehensive knowledge base for Aiken development:

**Built-in Sources:**
- **Aiken stdlib**: Core collections, crypto, math, and Cardano-specific utilities
- **Aiken prelude**: Built-in types (Bool, Int, ByteArray, List, Option)
- **Aiken documentation**: Fundamentals, language tour, tutorials, UPLC
- **Evolution SDK**: Complete SDK documentation and source code

**Knowledge Workflow:**
1. `aiken_knowledge_sync` - Clone/update sources to local cache
2. `aiken_knowledge_ingest` - Process sources into vector store
3. `aiken_knowledge_search` - Semantic search across all knowledge
4. `aiken_knowledge_add` - Add custom knowledge sources

**Search Scopes:**
- `project` - Current workspace files
- `stdlib*` - Aiken standard library variants
- `prelude` - Core language types
- `site*` - Official documentation
- `evolution*` - Evolution SDK resources
- `all` - Everything

### MCP prompts

- `aiken_validator_template`: Provides a basic template for writing an Aiken validator
- `aiken_development_tips`: Offers tips for Aiken smart contract development

### MCP resources

- `mcp_tools_manifest`: The JSON manifest of all available tools

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

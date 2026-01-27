# Knowledge Management Workflow

This document describes the knowledge ingestion, proposal, approval, and search workflow in aiken-devtools-mcp.

## Overview

The knowledge management system allows agents to ingest external documentation, libraries, and examples into a searchable knowledge base. The workflow consists of four main phases:

1. **Ingestion**: Convert web pages or git repositories into structured knowledge
2. **Proposal**: Create reviewable proposals for new knowledge sources
3. **Approval**: Human-reviewed approval of proposals
4. **Search**: Semantic search across all ingested knowledge

## Knowledge Sources

The system supports multiple types of knowledge sources:

- **Documentation**: Official docs, tutorials, guides
- **Libraries**: Code libraries and frameworks
- **Examples**: Sample projects and code snippets

Built-in sources include Aiken stdlib, prelude, documentation, and Evolution SDK.

## Workflow Steps

### 1. Ingest Knowledge

Use `aiken_knowledge_ingest` to ingest a single source:

```json
{
  "url": "https://github.com/aiken-lang/site",
  "category": "documentation"
}
```

Or `aiken_knowledge_bulk_ingest` for multiple sources:

```json
{
  "urls": ["https://example.com/docs"],
  "gitUrls": ["https://github.com/org/repo"],
  "category": "documentation",
  "autoAdd": true
}
```

### 2. Review Proposals

List pending proposals with `aiken_knowledge_proposals_list`:

```json
{
  "query": "aiken",
  "limit": 10
}
```

### 3. Approve Proposals

Approve a proposal with `aiken_knowledge_approve`:

```json
{
  "id": "proposal-id",
  "commit": true,
  "category": "documentation"
}
```

### 4. Sync and Search

Sync all knowledge sources to local cache:

```json
{
  "sources": ["all"],
  "compact": true
}
```

Search across knowledge:

```json
{
  "query": "ScriptHash.fromScript",
  "scope": "evolution-sdk",
  "maxResults": 5
}
```

## Security & Policy

- Server runs in readonly mode by default
- Use `--allow-tools` to enable destructive operations
- Tool calls are audited to `audit.log`
- Policy file `mcp-policy.json` can restrict tools

## Advanced Features

- **Embeddings**: Automatic vector embeddings for semantic search
- **JS Rendering**: Playwright-based rendering for dynamic content
- **Summarization**: LLM-generated abstracts for proposals
- **Auto-indexing**: Background indexing of new sources

Tool discovery, toolsets & categories
- The server provides a categorized manifest (`mcp-tools.json`) for host discovery. Use the `aiken_tools_catalog` tool to retrieve a `byCategory` map of available tools, which is convenient for UIs (e.g., VS Code) to show grouped tools.
- Toolsets: group related tools into named sets (e.g., `project`, `knowledge`, `blueprint`). Start the server with `--toolsets <csv>` or set `AIKEN_TOOLSETS` environment variable to enable a set of toolsets at startup.
- Dynamic toolsets: start the server with `--dynamic-toolsets` to allow runtime enabling/disabling of toolsets via the `aiken_toolsets_enable` tool. Use `aiken_toolsets_list` to inspect available toolsets and currently enabled sets.
- Lockdown & Insiders: use `--lockdown` to restrict networked tools from running in sensitive environments; use `--insiders` to enable experimental/insiders-only tools (not enabled by default).

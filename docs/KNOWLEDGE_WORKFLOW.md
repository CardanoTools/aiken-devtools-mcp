# Knowledge Management

A token-optimized knowledge base for Aiken smart contract development with semantic search and curated content.

## Quick Start

```bash
# Sync core knowledge sources
npm run aiken_knowledge_sync -- '{"sources": ["core"]}'

# Search for concepts
npm run aiken_knowledge_search -- '{"query": "validator script", "scope": "fundamentals"}'
```

## Knowledge Hierarchy

### Core Sources (Always Available)
- **fundamentals**: Getting started, installation, project structure
- **language**: Syntax, types, functions, pattern matching
- **stdlib**: Built-in functions and Cardano utilities
- **prelude**: Core types (Bool, Int, ByteArray, List, Option)

### Extended Sources (Sync Required)
- **examples**: Hello world, vesting contract, common patterns
- **evolution**: Lucid Evolution SDK documentation and examples
- **uplc**: Untyped Plutus Core reference

### Custom Sources (User-Added)
- Community libraries and frameworks
- Project-specific documentation
- Research papers and specifications

## Token-Optimized Search

### Semantic Search
```json
{
  "query": "how to validate transaction inputs",
  "scope": "fundamentals",
  "maxResults": 3
}
```

Returns ranked, concise results with:
- Relevance score
- Key code snippets (50-100 tokens each)
- Source attribution
- Minimal context

### Text Search
```json
{
  "query": "ScriptHash.fromScript",
  "scope": "stdlib",
  "compact": true
}
```

Returns deduplicated matches with:
- File location (relative path)
- Line number
- 80-char preview
- No duplicates

## Content Ingestion

### Smart Chunking
- **Context-aware**: Splits on section boundaries, not character count
- **Token-efficient**: 500-800 tokens per chunk with intelligent overlap
- **Quality-filtered**: Removes boilerplate, focuses on code and explanations

### Quality Assurance
- **Duplicate detection**: Avoids redundant content
- **Relevance scoring**: Prioritizes practical examples over theory
- **Freshness checks**: Updates stale documentation automatically

## Workflow

### 1. Sync Core Knowledge
```json
{"sources": ["core"], "compact": true}
```
Downloads and indexes essential Aiken documentation.

### 2. Add Custom Sources
```json
{
  "remoteUrl": "https://github.com/my-org/aiken-lib.git",
  "category": "library",
  "description": "Custom Aiken utilities"
}
```

### 3. Search & Learn
```json
{
  "query": "minting policy",
  "scope": "examples",
  "maxResults": 2
}
```

## Performance

- **Fast startup**: Core sources pre-indexed
- **Incremental sync**: Only updates changed content
- **Memory efficient**: Lazy loading and garbage collection
- **Token aware**: Results sized for LLM context windows

## Security

- **Robots.txt compliance**: Respects site crawling policies
- **Safe fetching**: Blocks private IPs and suspicious hosts
- **Content validation**: Sanitizes and filters ingested content
- **Audit logging**: All operations recorded

## Advanced Features

- **Multi-provider embeddings**: OpenAI, Anthropic, Cohere, GitHub Copilot
- **Vector storage**: Local file-based with optional external providers
- **Proposal system**: Human-reviewed content additions
- **Auto-categorization**: Intelligent source classification

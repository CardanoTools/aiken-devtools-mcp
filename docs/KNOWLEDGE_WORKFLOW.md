# Knowledge Workflow (aiken-devtools-mcp)

This project provides tools to ingest, propose, review, and add knowledge sources that the MCP tools use to ground agents.

Overview
- Ingest web pages or git repos: `aiken_knowledge_ingest` converts HTML → Markdown, chunks content, and writes a proposal markdown file under `src/knowledge/proposals/`.
- Review proposals: `aiken_knowledge_proposals_list` lists pending proposals for human inspection.
- Approve a proposal: `aiken_knowledge_approve` takes a proposal id and adds the `KnowledgeSourceSpec` to `src/knowledge/<category>/customAdded.ts` (optionally committing the change and archiving the proposal).
- Sync knowledge: `aiken_knowledge_sync` clones or updates repositories into the local cache (use `compact: true` to reduce tool output tokens).

Example flow (MCP tool calls):
1) Ingest a URL:
```json
{ "url": "https://github.com/aiken-lang/site" }
```
This writes `src/knowledge/proposals/aiken-lang-site.md` with a JSON `spec` and first chunk of Markdown.

2) List proposals:
```json
{ }
```

3) Approve proposal (committed by default):
```json
{ "id": "aiken-lang-site", "commit": true }
```
This will add the spec to `src/knowledge/documentation/customAdded.ts`, update index exports, and commit the change. The original proposal will be moved to `src/knowledge/proposals/approved/`.

Notes & next steps
- HTML → Markdown conversion uses `turndown` for better Markdown proposals. For better web rendering (JS), consider integrating the MCP `fetch` server or a Playwright-based fetcher.
- For semantic search, consider adding embeddings and a vector DB (Qdrant/Chroma) integration.

Security, transport, and policy
- The server can be launched via stdio (default) for easy integration with VS Code / Copilot Chat / Claude Code: `npx aiken-devtools-mcp`.
- By default the server runs in **readonly** safe mode. Use `--allow-tools` to allow specific tools or `--no-readonly` to disable readonly mode (not recommended for public use).
- The tool manifest is provided in `mcp-tools.json` and an administrator policy can be placed in `mcp-policy.json` to enforce per-tool allow/disallow rules.
- All tool calls are recorded to `audit.log` (redacts common secrets) for traceability.

Bulk ingest
- Use `aiken_knowledge_bulk_ingest` to ingest many URLs or git repositories in one call. It supports flags:
  - `urls`: array of web URLs to ingest
  - `gitUrls`: array of git repo URLs
  - `category`: `documentation|library|example`
  - `autoAdd`: automatically add accepted specs to `customAdded.ts`
  - `commit`: whether to commit added files (default: true)
  - `summarize`: request LLM summarization when available
  - `renderJs`: use Playwright to render JS-driven pages
  - `autoIndex`: compute embeddings for chunks and write to local vector store

If you'd like, I can next integrate the MCP `fetch` server for more robust web ingestion or add an automatic summarization step (LLM-based) to produce short abstracts for each proposal.

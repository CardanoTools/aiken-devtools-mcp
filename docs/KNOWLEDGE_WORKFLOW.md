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

If you'd like, I can next integrate the MCP `fetch` server for more robust web ingestion or add an automatic summarization step (LLM-based) to produce short abstracts for each proposal.
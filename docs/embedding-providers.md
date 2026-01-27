# Embedding providers & configuration

This repository supports **pluggable embedding providers** for indexing and semantic features. Use environment variables to indicate which providers are available and in what order they should be attempted.

## How it works

- `EMBEDDING_PROVIDERS` — comma-separated list of provider keys (priority order). Example: `openai,anthropic,cohere,github-copilot,http,pseudo`.
- The code tries providers in order and uses the first successful response. If no provider succeeds and `pseudo` is listed (and allowed), a deterministic pseudo-embedding is returned.
- Provider-specific credentials are read from environment variables (examples below).

## Supported providers & env vars

- `openai`
  - `OPENAI_API_KEY`
  - Optional: `EMBED_OPENAI_MODEL`, `OPENAI_MAX_INPUT_CHARS`

- `anthropic` (Claude embeddings if available)
  - `ANTHROPIC_API_KEY`
  - Optional: `EMBED_ANTHROPIC_MODEL`

- `cohere`
  - `COHERE_API_KEY`
  - Optional: `EMBED_COHERE_MODEL`

- `github-copilot` (experimental)
  - `GITHUB_COPILOT_TOKEN` or `GITHUB_TOKEN`
  - Optional: `GITHUB_COPILOT_EMBED_URL` (custom endpoint)

- `http` (generic HTTP adapter)
  - `EMBED_PROVIDER_URL` (POST JSON body: { input })
  - `EMBED_PROVIDER_API_KEY` (optional) and `EMBED_PROVIDER_HEADER` (default: `Authorization`)

- `pseudo` (deterministic fallback)
  - Controlled by `ALLOW_PSEUDO_EMBEDDINGS` (default: true in dev). Set to `false` to disable.
  - `EMBEDDING_DIM` can set the vector dimension (default 256).

## Examples

Use OpenAI primary with pseudo fallback:

```bash
export EMBEDDING_PROVIDERS="openai,pseudo"
export OPENAI_API_KEY="sk-..."
```

Use Copilot first (experimental), then OpenAI, then pseudo:

```bash
export EMBEDDING_PROVIDERS="github-copilot,openai,pseudo"
export GITHUB_COPILOT_TOKEN="..."
export OPENAI_API_KEY="..."
```

Local dev (fast, deterministic):

```bash
export EMBEDDING_PROVIDERS="pseudo"
export ALLOW_PSEUDO_EMBEDDINGS=true
```

## Testing locally

After building the project, run the test script that verifies the `pseudo` provider:

```bash
npm run build && node scripts/test_embeddings_providers.js
```

## Notes & best practices

- Prefer minimal, scoped credentials for hosted environments.
- For host integrations (Copilot, Claude, etc.) the host may supply a token or endpoint; use those values through env vars or the host's configuration mechanism.
- Avoid committing provider tokens in config files; use environment variables or secret stores.

If you want, I can add a small CLI helper to validate provider credentials and print which provider will be used for a sample input (useful for CI and troubleshooting).

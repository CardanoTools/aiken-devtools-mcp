import crypto from 'node:crypto';

export type EmbeddingResult = {
  vector: number[];
  provider: string;
  pseudo?: boolean;
};

const DEFAULT_DIM = Number(process.env.EMBEDDING_DIM ?? 256);
const OPENAI_EMBED_URL = process.env.EMBED_OPENAI_URL ?? "https://api.openai.com/v1/embeddings";
const ANTHROPIC_EMBED_URL = process.env.EMBED_ANTHROPIC_URL ?? "https://api.anthropic.com/v1/embeddings";
const COHERE_EMBED_URL = process.env.EMBED_COHERE_URL ?? "https://api.cohere.ai/v1/embed";

function truncate(text: string, max = 3000): string {
  return text.length > max ? text.slice(0, max) : text;
}

function getConfiguredProviders(): string[] {
  const env = process.env.EMBEDDING_PROVIDERS;
  if (env && env.trim()) return env.split(',').map(s => s.trim()).filter(Boolean);

  const order: string[] = [];
  if (process.env.OPENAI_API_KEY) order.push('openai');
  if (process.env.ANTHROPIC_API_KEY) order.push('anthropic');
  if (process.env.COHERE_API_KEY) order.push('cohere');
  if (process.env.GITHUB_COPILOT_TOKEN || process.env.GITHUB_TOKEN) order.push('github-copilot');
  if (process.env.EMBED_PROVIDER_URL) order.push('http');
  // always allow pseudo as last resort unless explicitly disabled
  order.push('pseudo');
  return order;
}

async function tryOpenAi(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.EMBED_OPENAI_MODEL ?? 'text-embedding-3-small';
  const input = truncate(text, Number(process.env.OPENAI_MAX_INPUT_CHARS ?? 3000));
  try {
    const body: any = { model, input };
    const res = await fetch(OPENAI_EMBED_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      return null;
    }

    const data: any = await res.json();
    const emb = data?.data?.[0]?.embedding as number[] | undefined;
    return emb ?? null;
  } catch (err) {
    return null;
  }
}

async function tryAnthropic(text: string): Promise<number[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.EMBED_ANTHROPIC_MODEL ?? 'claude-embed-1';
  const input = truncate(text, Number(process.env.ANTHROPIC_MAX_INPUT_CHARS ?? 3000));

  try {
    const body: any = { model, input };
    const res = await fetch(ANTHROPIC_EMBED_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) return null;
    const data: any = await res.json();
    // support common shapes
    const emb = data?.data?.[0]?.embedding ?? data?.embedding ?? null;
    return Array.isArray(emb) ? (emb as number[]) : null;
  } catch (err) {
    return null;
  }
}

async function tryCohere(text: string): Promise<number[] | null> {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) return null;
  const model = process.env.EMBED_COHERE_MODEL ?? 'embed-english-v3.0';
  const input = truncate(text, Number(process.env.COHERE_MAX_INPUT_CHARS ?? 3000));

  try {
    // Cohere v2 API expects 'texts' array and 'input_type' for v3 models
    const body = { model, texts: [input], input_type: 'search_document' };
    const res = await fetch(COHERE_EMBED_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    // Cohere returns { embeddings: [[...], [...]] } - array of arrays
    const emb = data?.embeddings?.[0] ?? null;
    return Array.isArray(emb) ? (emb as number[]) : null;
  } catch (err) {
    return null;
  }
}

async function tryHttpAdapter(text: string): Promise<number[] | null> {
  const url = process.env.EMBED_PROVIDER_URL;
  if (!url) return null;
  const key = process.env.EMBED_PROVIDER_API_KEY ?? process.env.EMBED_PROVIDER_KEY;
  const headerName = process.env.EMBED_PROVIDER_HEADER ?? 'Authorization';
  const input = truncate(text, Number(process.env.EMBED_PROVIDER_MAX_INPUT_CHARS ?? 5000));

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers[headerName] = `Bearer ${key}`;

    const body = { input }; // conservative payload
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) return null;
    const data: any = await res.json();
    const emb = data?.data?.[0]?.embedding ?? data?.embedding ?? null;
    return Array.isArray(emb) ? (emb as number[]) : null;
  } catch (err) {
    return null;
  }
}

function pseudoEmbedding(text: string, dim: number): number[] {
  // Deterministic pseudo-embedding based on sha256 digest; values in [-1, 1]
  const out: number[] = [];
  let counter = 0;
  while (out.length < dim) {
    const h = crypto.createHash('sha256').update(text + '|' + counter).digest();
    for (let i = 0; i < h.length && out.length < dim; i++) {
      // Buffer indexing within bounds; Number(h[i]) always yields a number 0-255
      const byte = Number(h[i]);
      out.push(byte / 255 * 2 - 1);
    }
    counter++;
  }
  return out.slice(0, dim);
}

export async function getEmbeddingWithProvider(text: string, opts?: { allowPseudo?: boolean; dim?: number }): Promise<EmbeddingResult | null> {
  const allowPseudo = typeof opts?.allowPseudo === 'boolean' ? opts!.allowPseudo : (process.env.ALLOW_PSEUDO_EMBEDDINGS ? process.env.ALLOW_PSEUDO_EMBEDDINGS !== 'false' : true);
  const dim = opts?.dim ?? DEFAULT_DIM;

  const providers = getConfiguredProviders();

  for (const p of providers) {
    try {
      if (p === 'openai') {
        const emb = await tryOpenAi(text);
        if (emb) return { vector: emb, provider: 'openai', pseudo: false };
        continue;
      }

      if (p === 'anthropic') {
        const emb = await tryAnthropic(text);
        if (emb) return { vector: emb, provider: 'anthropic', pseudo: false };
        continue;
      }

      if (p === 'cohere') {
        const emb = await tryCohere(text);
        if (emb) return { vector: emb, provider: 'cohere', pseudo: false };
        continue;
      }

      if (p === 'github-copilot') {
        // Experimental: allow forwarding to a user-provided Copilot-compatible endpoint
        const url = process.env.GITHUB_COPILOT_EMBED_URL || process.env.COPILOT_EMBED_URL;
        const token = process.env.GITHUB_COPILOT_TOKEN || process.env.GITHUB_TOKEN;
        if (url && token) {
          const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
          try {
            const body = { input: truncate(text, 3000) };
            const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            if (res.ok) {
              const data: any = await res.json();
              const emb = data?.data?.[0]?.embedding ?? data?.embedding ?? null;
              if (Array.isArray(emb)) return { vector: emb as number[], provider: 'github-copilot', pseudo: false };
            }
          } catch { }
        }
        continue;
      }

      if (p === 'http' || p === 'custom') {
        const emb = await tryHttpAdapter(text);
        if (emb) return { vector: emb, provider: 'http', pseudo: false };
        continue;
      }

      if (p === 'pseudo') {
        if (!allowPseudo) continue;
        const emb = pseudoEmbedding(text, dim);
        return { vector: emb, provider: 'pseudo', pseudo: true };
      }

      // unknown provider -> skip
    } catch (err) {
      // ignore and try next
    }
  }

  return null;
}

export async function getEmbedding(text: string): Promise<number[] | null> {
  const res = await getEmbeddingWithProvider(text);
  return res ? res.vector : null;
}

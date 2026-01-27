const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";

export async function getOpenAiEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // truncate to a safe length
  const input = text.length > 3000 ? text.slice(0, 3000) : text;

  try {
    const body = {
      model: "text-embedding-3-small",
      input
    };

    const res = await fetch(OPENAI_EMBED_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      // console.error('OpenAI embedding failed', res.status);
      return null;
    }

    const data: any = await res.json();
    const emb = data?.data?.[0]?.embedding as number[] | undefined;
    return emb ?? null;
  } catch (err) {
    return null;
  }
}

export async function getEmbedding(text: string): Promise<number[] | null> {
  // For now only OpenAI is supported; future: add other providers
  return await getOpenAiEmbedding(text);
}

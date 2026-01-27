const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

const STOPWORDS = new Set(["the", "and", "is", "in", "at", "of", "a", "an", "to", "for", "with", "on", "by", "from", "that", "this", "it"]);

function splitSentences(text: string): string[] {
  // simple sentence splitter
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  return sentences;
}

function scoreSentence(sentence: string, freq: Map<string, number>): number {
  const words = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  let score = 0;
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    score += freq.get(w) ?? 0;
  }
  return score;
}

function extractiveSummary(text: string, maxSentences = 3): string {
  const sentences = splitSentences(text);
  if (sentences.length <= maxSentences) return sentences.join(" ");

  const freq = new Map<string, number>();
  for (const s of sentences) {
    for (const w of s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean)) {
      if (STOPWORDS.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }

  const scored = sentences.map(s => ({ s, score: scoreSentence(s, freq) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxSentences).map(x => x.s);
  // Preserve original ordering
  top.sort((a, b) => sentences.indexOf(a) - sentences.indexOf(b));
  return top.join(' ');
}

export async function summarizeText(text: string, maxSentences = 3): Promise<string> {
  // If OpenAI provider configured, attempt to use it
  if ((process.env.SUMMARIZER_PROVIDER === 'openai' || process.env.OPENAI_API_KEY) && process.env.OPENAI_API_KEY) {
    try {
      const prompt = `Summarize the following text in ${maxSentences} short sentences (concise, accurate):\n\n${text.slice(0, 16000)}`;
      const body = {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a concise summarization assistant." },
          { role: "user", content: prompt }
        ],
        max_tokens: 256
      };

      const res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`OpenAI summarization failed: ${res.status}`);
      const data: any = await res.json();
      const textOut = (data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? '').toString().trim();
      if (textOut.length) return textOut.replace(/\s+/g, ' ').trim();
    } catch (err) {
      // fallthrough to extractive
    }
  }

  // Fallback to extractive summary
  return extractiveSummary(text, maxSentences);
}

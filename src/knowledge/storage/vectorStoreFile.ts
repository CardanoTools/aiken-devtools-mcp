import fs from "node:fs/promises";
import path from "node:path";

export type VectorRecord = { id: string; vector: number[]; metadata?: Record<string, any> };

const BASE = path.join(process.cwd(), "var", "vectors");

async function ensureDir() {
  await fs.mkdir(BASE, { recursive: true });
}

async function collectionPath(collection: string) {
  await ensureDir();
  return path.join(BASE, `${collection}.jsonl`);
}

export async function upsertVectors(collection: string, records: VectorRecord[]): Promise<number> {
  const p = await collectionPath(collection);

  // Read existing records and filter out ids we will upsert
  let existing: VectorRecord[] = [];
  try {
    const raw = await fs.readFile(p, "utf8");
    existing = raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as VectorRecord)
      .filter(Boolean);
  } catch {
    existing = [];
  }

  const ids = new Set(records.map(r => r.id));
  const kept = existing.filter(r => !ids.has(r.id));
  const all = [...kept, ...records];

  // Write back full file
  const content = all.map(r => JSON.stringify(r)).join("\n") + "\n";
  await fs.writeFile(p, content, "utf8");
  return records.length;
}

export async function readAllVectors(collection: string): Promise<VectorRecord[]> {
  const p = await collectionPath(collection);
  try {
    const raw = await fs.readFile(p, "utf8");
    return raw.split("\n").filter(Boolean).map(l => JSON.parse(l) as VectorRecord);
  } catch {
    return [];
  }
}

export function cosine(a: number[], b: number[]) {
  let dot = 0; let na = 0; let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function queryVectors(collection: string, queryEmbedding: number[], topK = 10) {
  const all = await readAllVectors(collection);
  const scored = all.map(r => ({ r, score: cosine(r.vector, queryEmbedding) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => ({ id: s.r.id, metadata: s.r.metadata, score: s.score }));
}

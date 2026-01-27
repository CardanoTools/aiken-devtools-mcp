#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const url = process.argv[2] || 'https://github.com/aiken-lang/setup-aiken';
const maxChars = Number(process.argv[3]) || 300_000;
const collection = process.argv[4] || 'aiken-lang-setup-aiken';

async function loadModule(modulePath) {
  const m = await import(modulePath);
  return m.default ? m.default : m;
}

try {
  const ing = await loadModule(new URL('../dist/knowledge/ingest.js', import.meta.url).pathname);
  const emb = await loadModule(new URL('../dist/knowledge/embeddings.js', import.meta.url).pathname);
  const vs = await loadModule(new URL('../dist/knowledge/vectorStoreFile.js', import.meta.url).pathname);

  const ingestUrl = ing.ingestUrl || ing.default?.ingestUrl;
  const chunkText = ing.chunkText || ing.default?.chunkText;
  const getEmbeddingWithProvider = emb.getEmbeddingWithProvider || emb.default?.getEmbeddingWithProvider;
  const upsertVectors = vs.upsertVectors || vs.default?.upsertVectors;

  if (!ingestUrl || !chunkText || !getEmbeddingWithProvider || !upsertVectors) {
    console.error('Required functions not found in dist modules');
    process.exit(2);
  }

  console.log('Ingesting URL:', url, 'maxChars:', maxChars);
  const res = await ingestUrl(url, { maxChars, renderJs: false, summarize: false, autoIndex: false });
  console.log('Ingest result id=', res.id, 'proposalPath=', res.proposalPath);

  if (!res.proposalPath) {
    console.error('No proposalPath returned; cannot index.');
    process.exit(2);
  }

  const raw = await fs.readFile(res.proposalPath, 'utf8').catch(() => '');
  const mdMatch = raw.match(/```markdown\n([\s\S]*?)\n```/i);
  const text = (mdMatch && mdMatch[1]) ? mdMatch[1] : (res.summary || '');
  if (!text || text.trim().length < 32) {
    console.error('No substantive text to index.');
    process.exit(2);
  }

  const chunks = chunkText(text, 3000, 200);
  console.log('Prepared chunks:', chunks.length);

  const records = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i] || '';
    if (!c) continue;
    const embRes = await getEmbeddingWithProvider(c, { allowPseudo: true });
    if (!embRes || !embRes.vector) continue;
    records.push({ id: `${res.id}#${i}`, vector: embRes.vector, metadata: { source: url, proposalId: res.id, index: i, text: c.slice(0, 256), provider: embRes.provider, pseudo: !!embRes.pseudo } });
  }

  if (!records.length) {
    console.error('No embeddings generated - aborting.');
    process.exit(2);
  }

  const count = await upsertVectors(collection, records);
  console.log('Upserted vectors:', count, 'collection:', collection);

  // Optionally cleanup proposal
  try { await fs.unlink(res.proposalPath).catch(() => { }); } catch (e) { }

  process.exit(0);
} catch (err) {
  console.error('Failed to ingest + index:', String(err));
  process.exit(2);
}

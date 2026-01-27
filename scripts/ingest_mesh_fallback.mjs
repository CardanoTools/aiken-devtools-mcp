import { ingestUrl, chunkText } from '../dist/knowledge/ingest.js';
import { getEmbeddingWithProvider } from '../dist/knowledge/embeddings.js';
import { upsertVectors } from '../dist/knowledge/vectorStoreFile.js';
import fs from 'node:fs/promises';

const src = { id: 'mesh-aiken-template', url: 'https://github.com/MeshJS/aiken-next-ts-template.git', collection: 'mesh-aiken-next-ts-template' };
const MAX_CHARS = 150000;
const CHUNK_SIZE = 3000;
const CHUNK_OVERLAP = 200;

async function run() {
  console.log('Processing fallback for', src.url);
  try {
    let res;
    try {
      res = await ingestUrl(src.url, { maxChars: MAX_CHARS, renderJs: false, summarize: false, autoIndex: false });
    } catch (firstErr) {
      const raw = src.url.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace(/\.git$/i, '') + '/main/README.md';
      console.log('Fetch failed, trying raw README:', raw);
      res = await ingestUrl(raw, { maxChars: MAX_CHARS, renderJs: false, summarize: false, autoIndex: false });
    }

    console.log('ingestUrl result id=', res?.id, 'proposalPath=', res?.proposalPath);
    if (!res || !res.proposalPath) {
      console.error('No proposalPath for', src.url);
      return;
    }

    const raw = await fs.readFile(res.proposalPath, 'utf8').catch(() => '');
    const mdMatch = raw.match(/```markdown\n([\s\S]*?)\n```/i);
    const text = (mdMatch && mdMatch[1]) ? mdMatch[1] : (res.summary || '');
    if (!text || text.trim().length < 32) {
      console.error('No substantive text to index for', src.url);
      return;
    }

    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log('Prepared chunks:', chunks.length);

    const records = [];
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i] || '';
      if (!c) continue;
      const embRes = await getEmbeddingWithProvider(c, { allowPseudo: true });
      if (!embRes || !embRes.vector) continue;
      records.push({ id: `${res.id}#${i}`, vector: embRes.vector, metadata: { source: src.url, proposalId: res.id, index: i, text: c.slice(0, 256), provider: embRes.provider, pseudo: !!embRes.pseudo } });
    }

    if (!records.length) {
      console.error('No embeddings generated - skipping', src.collection);
      return;
    }

    const count = await upsertVectors(src.collection, records);
    console.log('Upserted vectors:', count, 'collection:', src.collection);

  } catch (err) {
    console.error('Fallback ingest failed for', src.url, String(err));
  }
}

run();

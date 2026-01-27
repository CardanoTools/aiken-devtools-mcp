import { ingestUrl, chunkText } from '../dist/knowledge/ingest.js';
import { getEmbeddingWithProvider } from '../dist/knowledge/embeddings.js';
import { upsertVectors } from '../dist/knowledge/vectorStoreFile.js';
import fs from 'node:fs/promises';

const SOURCES = [
  { id: 'aiken-lang-site', url: 'https://github.com/aiken-lang/site.git', collection: 'aiken-lang-site' },
  { id: 'aiken-lang-aiken', url: 'https://github.com/aiken-lang/aiken.git', collection: 'aiken-lang-aiken' },
  { id: 'aiken-awesome', url: 'https://github.com/aiken-lang/awesome-aiken.git', collection: 'aiken-lang-awesome-aiken' },
  { id: 'mesh-aiken-template', url: 'https://github.com/MeshJS/aiken-next-ts-template.git', collection: 'mesh-aiken-next-ts-template' },
  { id: 'cardano-academy-aiken-course', url: 'https://cardanofoundation.org/academy/course/aiken-eutxo-smart-contracts-cardano', collection: 'cardano-academy-aiken-course' },
  { id: 'aiken-setup', url: 'https://github.com/aiken-lang/setup-aiken.git', collection: 'aiken-lang-setup-aiken' }
];

const MAX_CHARS = 150000;
const CHUNK_SIZE = 3000;
const CHUNK_OVERLAP = 200;

async function processSource(src) {
  console.log('\n=== Ingesting:', src.url, '->', src.collection, '===');
  try {
    let res;
    try {
      res = await ingestUrl(src.url, { maxChars: MAX_CHARS, renderJs: false, summarize: false, autoIndex: false });
    } catch (firstErr) {
      // Fallback: if it's a GitHub repo that failed (size limits), try the raw README.md
      if (src.url.includes('github.com')) {
        try {
          const raw = src.url.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace(/\.git$/i, '') + '/main/README.md';
          console.log('Initial fetch failed, retrying with raw README:', raw);
          res = await ingestUrl(raw, { maxChars: MAX_CHARS, renderJs: false, summarize: false, autoIndex: false });
        } catch (rawErr) {
          throw firstErr;
        }
      } else {
        throw firstErr;
      }
    }

    console.log('ingestUrl result id=', res?.id, 'proposalPath=', res?.proposalPath);

    if (!res || !res.proposalPath) {
      console.error('No proposalPath for', src.url);
      return;
    }

    let raw = '';
    try {
      raw = await fs.readFile(res.proposalPath, 'utf8');
    } catch (e) {
      raw = '';
    }

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

    // try cleanup
    try { await fs.unlink(res.proposalPath).catch(() => { }); } catch (e) { }
  } catch (err) {
    console.error('Failed to ingest + index', src.url, String(err));
  }
}

(async () => {
  for (const s of SOURCES) {
    await processSource(s);
  }
  console.log('\nBatch ingest complete.');
})();

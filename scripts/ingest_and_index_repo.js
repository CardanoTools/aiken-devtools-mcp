(async () => {
  const { ingestUrl } = require('../dist/knowledge/ingest.js');
  const { getEmbedding } = require('../dist/knowledge/embeddings.js');
  const { upsertVectors } = require('../dist/knowledge/vectorStoreFile.js');
  const { chunkText } = require('../dist/knowledge/ingest.js');
  const fs = require('fs').promises;
  const path = require('path');

  const url = process.argv[2] || 'https://github.com/aiken-lang/aiken';
  const maxChars = Number(process.argv[3]) || 300_000;
  const collection = process.argv[4] || 'aiken-lang-aiken';

  console.log('Ingesting URL:', url, 'maxChars:', maxChars);
  try {
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

    function pseudoEmbedding(str, dim = 256) {
      const crypto = require('crypto');
      const out = [];
      let counter = 0;
      while (out.length < dim) {
        const h = crypto.createHash('sha256').update(str + '|' + counter).digest();
        for (let i = 0; i < h.length && out.length < dim; i++) {
          // map byte 0..255 to -1..1
          out.push(h[i] / 255 * 2 - 1);
        }
        counter++;
      }
      return out;
    }

    let usedFallback = false;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i] || '';
      if (!c) continue;
      let emb = await getEmbedding(c);
      if (!emb) {
        // fallback to deterministic pseudo-embedding so indexing can proceed without OpenAI key
        emb = pseudoEmbedding(c, 256);
        usedFallback = true;
      }
      records.push({ id: `${res.id}#${i}`, vector: emb, metadata: { source: url, proposalId: res.id, index: i, text: c.slice(0, 256), pseudo: usedFallback } });
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
})();

#!/usr/bin/env node
// Validate embedding provider config and print which provider will be used for a sample input
(async () => {
  const { getEmbeddingWithProvider } = require('../dist/knowledge/embeddings.js');
  const text = process.argv[2] || 'Embedding provider validation test.';
  const dim = Number(process.env.EMBEDDING_DIM || 64);
  const allowPseudo = process.env.ALLOW_PSEUDO_EMBEDDINGS !== 'false';
  try {
    const res = await getEmbeddingWithProvider(text, { allowPseudo, dim });
    if (!res || !res.vector) {
      console.error('❌ No embedding returned. Check EMBEDDING_PROVIDERS and provider credentials.');
      process.exit(2);
    }
    console.log('✅ Provider:', res.provider, '| pseudo:', !!res.pseudo, '| dim:', res.vector.length);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err && err.message ? err.message : String(err));
    process.exit(2);
  }
})();

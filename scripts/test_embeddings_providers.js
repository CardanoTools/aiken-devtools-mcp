(async () => {
  const { getEmbeddingWithProvider } = require('../dist/knowledge/embeddings.js');

  // Force pseudo provider for deterministic local tests
  process.env.EMBEDDING_PROVIDERS = 'pseudo';
  process.env.ALLOW_PSEUDO_EMBEDDINGS = 'true';

  const text = 'This is a test for embeddings provider fallback.';
  const res = await getEmbeddingWithProvider(text, { allowPseudo: true, dim: 128 });
  if (!res || !res.vector) {
    console.error('Embedding provider test failed: no embedding returned');
    process.exit(2);
  }
  console.log('OK provider=', res.provider, 'pseudo=', !!res.pseudo, 'dim=', res.vector.length);
  process.exit(0);
})();

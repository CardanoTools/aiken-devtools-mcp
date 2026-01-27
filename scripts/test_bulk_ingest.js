(async () => {
  const { ingestUrl } = require('../dist/knowledge/ingest.js');
  const urls = [
    'https://github.com/aiken-lang/site',
    'https://raw.githubusercontent.com/aiken-lang/site/main/README.md'
  ];

  for (const u of urls) {
    try {
      console.log('Ingesting', u);
    const r = await ingestUrl(u, { maxChars: 200000, summarize: true });
      console.log('->', r.id, 'chunks:', r.chunks.length, 'proposal:', r.proposalPath);
    } catch (err) {
      console.error('Failed to ingest', u, String(err));
    }
  }
})();

(async () => {
  const { ingestUrl } = require('../dist/knowledge/ingest.js');

  console.log('Test: ingest with renderJs=true on https://example.com (Playwright may be used or fallback to fetch)');
  try {
    const res = await ingestUrl('https://example.com/', { renderJs: true, maxChars: 20000 });
    console.log('OK id=', res.id, 'title=', res.title);

    // cleanup proposal if created
    try {
      if (res && res.proposalPath) await require('fs').promises.unlink(res.proposalPath).catch(() => {});
    } catch {}

    process.exit(0);
  } catch (err) {
    console.error('FAIL', String(err));
    process.exit(2);
  }
})();

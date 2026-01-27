(async () => {
  const { ingestUrl } = require('../dist/knowledge/ingest.js');

  const html = '<html><body><div id="ok">rendered</div><img src="http://127.0.0.1/should-be-blocked.png" /></body></html>';
  const dataUrl = 'data:text/html,' + encodeURIComponent(html);

  console.log('Test: ingest with renderJs=true on a data: page with a private-host subresource (should succeed and not throw)');
  try {
    const res = await ingestUrl(dataUrl, { renderJs: true, maxChars: 20000 });
    console.log('OK id=', res.id, 'summaryPreview=', res.summary?.slice(0, 80));

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

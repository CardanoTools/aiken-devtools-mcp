(async () => {
  const { ingestUrl } = require('../dist/knowledge/ingest.js');

  console.log('Testing private IP protection (127.0.0.1) - expect error');
  try {
    await ingestUrl('http://127.0.0.1/');
    console.error('FAIL: expected error for private IP');
    process.exit(2);
  } catch (err) {
    console.log('OK (private IP blocked):', String(err));
  }

  console.log('Testing public fetch (https://example.com) - may fail if network disabled or robots disallow');
  try {
    const res = await ingestUrl('https://example.com/');
    console.log('OK fetched example.com id=', res.id);
    // cleanup generated proposal file to avoid commit noise
    try {
      const fsp = require('fs').promises;
      if (res && res.proposalPath) await fsp.unlink(res.proposalPath).catch(() => {});
    } catch (e) {
      // ignore cleanup errors
    }
  } catch (err) {
    console.log('Fetch failed (expected in some environments):', String(err));
  }

  process.exit(0);
})();

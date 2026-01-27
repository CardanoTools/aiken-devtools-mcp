(async () => {
  const fs = require('fs').promises;
  const { attachPolicyWrapper } = require('../dist/serverWrapper.js');
  const { registerAikenServerManifestTool } = require('../dist/tools/aikenServerManifest.js');

  let registered = null;
  const fakeServer = { registerTool(name, config, handler) { registered = { name, config, handler } } };
  attachPolicyWrapper(fakeServer);
  registerAikenServerManifestTool(fakeServer);

  if (!registered) { console.error('not registered'); process.exit(2); }

  try {
    const res = await registered.handler({});
    console.log('handler returned structured content keys:', Object.keys(res.structuredContent || {}).length);
  } catch (err) {
    console.error('handler failed', err.message);
    process.exit(2);
  }

  process.exit(0);
})();

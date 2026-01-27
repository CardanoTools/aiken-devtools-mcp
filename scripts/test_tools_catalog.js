(async () => {
  const { registerAikenToolsCatalogTool } = require('../dist/tools/aikenToolsCatalog.js');

  let registered = null;
  const fakeServer = { registerTool(name, config, handler) { registered = { name, config, handler } } };

  registerAikenToolsCatalogTool(fakeServer);

  if (!registered) { console.error('not registered'); process.exit(2); }

  try {
    const res = await registered.handler({});
    if (!res || !res.structuredContent || !res.structuredContent.byCategory) {
      console.error('unexpected result', res);
      process.exit(2);
    }
    console.log('catalog categories:', Object.keys(res.structuredContent.byCategory).join(', '));
    process.exit(0);
  } catch (err) {
    console.error('handler failed', err.message);
    process.exit(2);
  }
})();

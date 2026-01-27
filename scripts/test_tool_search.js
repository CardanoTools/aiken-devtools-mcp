(async () => {
  const { registerAikenToolSearchTool } = require('../dist/tools/aikenToolSearch.js');

  let registered = null;
  const fakeServer = { registerTool(name, config, handler) { registered = { name, config, handler } } };

  registerAikenToolSearchTool(fakeServer);

  if (!registered) { console.error('Tool not registered'); process.exit(2); }

  const res = await registered.handler({ query: 'knowledge' });
  console.log('matches:', res.structuredContent?.tools?.length);
  process.exit(0);
})();

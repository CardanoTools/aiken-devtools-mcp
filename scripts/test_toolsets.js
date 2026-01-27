(async () => {
  const { registerAikenToolsetsTools } = require('../dist/tools/aikenToolsets.js');
  const { runtimeConfig } = require('../dist/runtimeConfig.js');

  let registered = null;
  const fakeServer = {
    registerTool(name, config, handler) {
      if (!registered) registered = { name, config, handler };
    }
  };

  registerAikenToolsetsTools(fakeServer);

  if (!registered) { console.error('No tool registered'); process.exit(2); }

  // invoke list handler
  const listRes = await registered.handler({});
  console.log('list ok?', !!listRes.structuredContent);

  // enable requires dynamicToolsets enabled
  runtimeConfig.dynamicToolsets = true;
  const enableTool = require('../dist/tools/aikenToolsets.js').registerAikenToolsetsTools;

  // find the enable tool in a new fake server
  let reg2 = null;
  const fakeServer2 = { registerTool(name, config, handler) { if (!reg2) reg2 = { name, config, handler } } };
  registerAikenToolsetsTools(fakeServer2);

  const res = await reg2.handler({ toolsets: ['default'], enable: true });
  console.log('enable result', res.structuredContent);
  process.exit(0);
})();

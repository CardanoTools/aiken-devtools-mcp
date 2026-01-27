(async () => {
  const { attachPolicyWrapper, applyAllowedToolsets } = require('../dist/serverWrapper.js');
  const { runtimeConfig } = require('../dist/runtimeConfig.js');

  // Reset runtime config
  runtimeConfig.toolsetsMap = { alpha: ['test_tool_1'], beta: ['test_tool_2'] };
  runtimeConfig.allowedToolsets = new Set();

  const regs = {};

  const fakeServer = {
    registerTool(name, config, handler) {
      const reg = {
        name,
        config,
        handler,
        enabled: true,
        enable() { this.enabled = true; },
        disable() { this.enabled = false; }
      };
      regs[name] = reg;
      return reg;
    }
  };

  // attach wrapper
  attachPolicyWrapper(fakeServer);

  // ensure our test toolsets map overrides any manifest-derived map
  runtimeConfig.toolsetsMap = { alpha: ['test_tool_1'], beta: ['test_tool_2'] };
  runtimeConfig.allowedToolsets = new Set();

  // register two tools in different toolsets
  fakeServer.registerTool('test_tool_1', { _meta: { toolsets: ['alpha'] } }, async () => ({}));
  fakeServer.registerTool('test_tool_2', { _meta: { toolsets: ['beta'] } }, async () => ({}));

  console.log('initial states:', { t1: regs['test_tool_1'].enabled, t2: regs['test_tool_2'].enabled });

  // enable only alpha
  console.log('runtimeConfig.toolsetsMap before:', runtimeConfig.toolsetsMap);
  applyAllowedToolsets(new Set(['alpha']));

  for (const name of Object.keys(regs)) {
    const allow = (runtimeConfig.allowedToolsets.size > 0 ? Array.from(runtimeConfig.allowedToolsets).some(ts => (runtimeConfig.toolsetsMap[ts] || []).includes(name)) : true) || (runtimeConfig.allowedTools && runtimeConfig.allowedTools.has(name));
    console.log('tool', name, 'allowed?', allow, 'enabled?', regs[name].enabled);
  }

  // enable none (clear toolset restriction)
  applyAllowedToolsets(new Set());
  console.log('after clearing enabled sets:', { t1: regs['test_tool_1'].enabled, t2: regs['test_tool_2'].enabled });

  process.exit(0);
})();

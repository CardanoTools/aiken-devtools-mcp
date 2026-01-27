(async () => {
  const { attachPolicyWrapper } = require('../dist/serverWrapper.js');
  const { setAllowedTools, runtimeConfig } = require('../dist/runtimeConfig.js');
  const { registerAikenKnowledgeAddTool } = require('../dist/tools/aikenKnowledgeAdd.js');

  let registered = null;
  const fakeServer = {
    registerTool(name, config, handler) {
      registered = { name, config, handler };
    }
  };

  // Apply wrapper
  attachPolicyWrapper(fakeServer);

  // Ensure policy loaded state: by default mcp-policy.json disallows add
  // Try registering the add tool
  registerAikenKnowledgeAddTool(fakeServer);

  if (!registered) {
    console.error('Failed to register');
    process.exit(2);
  }

  console.log('Registered tool:', registered.name);

  try {
    await registered.handler({ remoteUrl: 'https://github.com/example/repo.git', commit: false });
    console.log('Handler succeeded (unexpected)');
  } catch (err) {
    console.error('Handler error as expected:', err.message);
    process.exit(0);
  }

  process.exit(1);
})();

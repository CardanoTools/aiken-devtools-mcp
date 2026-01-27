(async () => {
  const { registerAikenKnowledgeBulkIngestTool } = require('../dist/tools/aikenKnowledgeBulkIngest.js');

  let registered = null;

  const fakeServer = {
    registerTool(name, config, cb) {
      registered = { name, config, cb };
    }
  };

  registerAikenKnowledgeBulkIngestTool(fakeServer);

  if (!registered) {
    console.error('Tool did not register');
    process.exit(1);
  }

  console.log('Registered tool:', registered.name);

  const urls = [
    'https://raw.githubusercontent.com/aiken-lang/site/main/README.md',
    'https://raw.githubusercontent.com/aiken-lang/site/main/CONTRIBUTING.md'
  ];

  const res = await registered.cb({ urls, gitUrls: [], autoAdd: false, commit: false, summarize: false, renderJs: false });
  console.log('Result:', res.structuredContent || res);
})();

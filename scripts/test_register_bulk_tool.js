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

  // invoke the handler with sample args (empty arrays) — should return structuredContent
  const res = await registered.cb({ urls: [], gitUrls: [], autoAdd: false, commit: false, summarize: false });
  console.log('Handler returned:', res.structuredContent || res);
})();

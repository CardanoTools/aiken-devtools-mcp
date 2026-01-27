(async () => {
  const fs = require('fs').promises;
  const { attachPolicyWrapper } = require('../dist/serverWrapper.js');
  const { registerAikenKnowledgeProposalsListTool } = require('../dist/tools/aikenKnowledgeProposalsList.js');
  const { runtimeConfig } = require('../dist/runtimeConfig.js');

  // clear audit log
  try { await fs.unlink('audit.log'); } catch {}

  let registered = null;
  const fakeServer = {
    registerTool(name, config, handler) { registered = { name, config, handler }; }
  };

  attachPolicyWrapper(fakeServer);
  registerAikenKnowledgeProposalsListTool(fakeServer);

  if (!registered) { console.error('not registered'); process.exit(2); }
  console.log('invoking', registered.name);

  try {
    const res = await registered.handler({});
    console.log('result ok');
  } catch (err) {
    console.error('handler failed', err.message);
    process.exit(2);
  }

  const raw = await fs.readFile('audit.log', 'utf8');
  const lines = raw.trim().split('\n');
  console.log('audit lines:', lines.length);
  const last = JSON.parse(lines[lines.length - 1]);
  console.log('last entry:', last.tool, last.time);

  process.exit(0);
})();

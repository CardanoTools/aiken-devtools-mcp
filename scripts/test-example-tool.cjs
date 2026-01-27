#!/usr/bin/env node
const fs = require('fs').promises;

async function main() {
  const raw = await fs.readFile('mcp-tools.json', 'utf8');
  const parsed = JSON.parse(raw);
  const tools = parsed.tools || [];
  const t = tools.find(x => x && x.name === 'aiken_example');
  if (!t) {
    console.error('aiken_example not found in mcp-tools.json');
    process.exit(1);
  }
  console.log('Found aiken_example:');
  console.log(`${t.name}\t${t.title || ''}\t${t.description || ''}`);
}

main().catch(err => { console.error(err); process.exit(2); });

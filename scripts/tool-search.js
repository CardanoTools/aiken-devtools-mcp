#!/usr/bin/env node
const fs = require('fs').promises;
async function main() {
  const q = process.argv.slice(2).join(' ').trim();
  if (!q) { console.error('Usage: node scripts/tool-search.js <query>'); process.exit(2); }
  const raw = await fs.readFile('mcp-tools.json', 'utf8');
  const parsed = JSON.parse(raw);
  const tools = parsed.tools || [];
  const lower = q.toLowerCase();
  const matches = tools.filter(t => {
    if (!t || !t.name) return false;
    if ((t.name || '').toLowerCase().includes(lower)) return true;
    if ((t.title || '').toLowerCase().includes(lower)) return true;
    if ((t.description || '').toLowerCase().includes(lower)) return true;
    return false;
  });
  if (!matches.length) { console.error('No matches'); process.exit(1); }
  for (const m of matches) {
    console.log(`${m.name}\t${m.title || ''}\t${m.description || ''}`);
  }
}
main().catch(err => { console.error(err); process.exit(2); });

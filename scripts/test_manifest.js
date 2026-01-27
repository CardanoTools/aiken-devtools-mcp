(async () => {
  const fs = require('fs').promises;
  try {
    const raw = await fs.readFile('mcp-tools.json', 'utf8');
    const parsed = JSON.parse(raw);
    console.log('Manifest tool count:', (parsed.tools || []).length);
    process.exit(0);
  } catch (err) {
    console.error('Manifest missing or invalid', String(err));
    process.exit(2);
  }
})();

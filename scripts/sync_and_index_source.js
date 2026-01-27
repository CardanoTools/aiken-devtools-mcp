(async () => {
  const { ALL_KNOWLEDGE_SOURCES } = require('../dist/knowledge/index.js');
  const { resolveRepoBaseDirPath, resolveSourceDirPath, getCacheBaseDir } = require('../dist/knowledge/utils.js');
  const { runGit } = require('../dist/git/runGit.js');
  const { chunkText } = require('../dist/knowledge/ingest.js');
  const { getEmbedding } = require('../dist/knowledge/embeddings.js');
  const { upsertVectors } = require('../dist/knowledge/vectorStoreFile.js');
  const fs = require('fs').promises;
  const path = require('path');

  const sourceId = process.argv[2] || 'aiken-lang-aiken';
  const spec = ALL_KNOWLEDGE_SOURCES.find(s => s.id === sourceId);
  if (!spec) {
    console.error('Source not found:', sourceId);
    process.exit(2);
  }

  const repoBase = resolveRepoBaseDirPath(spec);
  const root = resolveSourceDirPath(spec);
  const cacheDir = getCacheBaseDir();

  // clone if missing
  const exists = await fs.stat(repoBase).then(() => true).catch(() => false);

  try {
    if (!exists) {
      console.log('Cloning', spec.remoteUrl, '->', repoBase);
      const clone = await runGit({ cwd: cacheDir, args: ['clone', '--depth', '1', '--branch', spec.defaultRef || 'main', spec.remoteUrl, spec.folderName], timeoutMs: 5 * 60 * 1000 });
      if (!clone.ok || clone.exitCode !== 0) {
        console.error('git clone failed:', clone.error || clone.stderr || clone.stdout);
        process.exit(2);
      }
      console.log('Clone succeeded');
    } else {
      console.log('Repo already present, fetching and updating');
      const fetch = await runGit({ cwd: repoBase, args: ['fetch', '--all', '--tags', '--prune'], timeoutMs: 5 * 60 * 1000 });
      if (!fetch.ok) console.warn('git fetch error:', fetch.error);
      const checkout = await runGit({ cwd: repoBase, args: ['checkout', spec.defaultRef || 'main'], timeoutMs: 2 * 60 * 1000 });
      if (!checkout.ok) console.warn('git checkout error:', checkout.error);
      const pull = await runGit({ cwd: repoBase, args: ['pull', '--ff-only'], timeoutMs: 2 * 60 * 1000 });
      if (!pull.ok) console.warn('git pull warning:', pull.error);
    }
  } catch (err) {
    console.error('Failed to sync repo:', String(err));
    process.exit(2);
  }

  // Walk files and index
  const exts = ['.md', '.markdown', '.ak', '.txt', '.toml', '.rs', '.mdx'];
  const records = [];
  let totalChunks = 0;

  const stat = await fs.stat(root).catch(() => undefined);
  if (!stat || !stat.isDirectory()) {
    console.error('Source path not available locally:', root);
    process.exit(2);
  }

  const queue = [root];
  const chunkSize = 3000;
  const overlap = 200;

  while (queue.length) {
    const dir = queue.shift();
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['.git', 'node_modules', 'dist', 'target'].includes(e.name)) continue;
        queue.push(full);
        continue;
      }
      if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (!exts.includes(ext)) continue;
        const raw = await fs.readFile(full, 'utf8').catch(() => '');
        if (!raw || raw.trim().length < 20) continue;
        const chunks = chunkText(raw, chunkSize, overlap);
        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i] || '';
          if (!c) continue;
          const emb = await getEmbedding(c);
          if (!emb) continue; // skip if embedding not available
          records.push({ id: `${sourceId}:${path.relative(root, full)}#${i}`, vector: emb, metadata: { sourceId, file: path.relative(root, full), index: i, text: c.slice(0, 256) } });
          totalChunks++;
        }
      }
    }
  }

  if (!records.length) {
    console.error('No vectors generated. Is OPENAI_API_KEY set?');
    process.exit(2);
  }

  try {
    const count = await upsertVectors(sourceId, records);
    console.log('Indexed vectors:', count, 'collection:', sourceId, 'totalChunks:', totalChunks);
    process.exit(0);
  } catch (err) {
    console.error('Failed to upsert vectors:', String(err));
    process.exit(2);
  }
})();

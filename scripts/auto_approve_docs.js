(async () => {
  const { ingestUrl } = require('../dist/knowledge/ingest.js');
  const { addCustomSource, ensureIndexExportsForCategory } = require('../dist/knowledge/customManager.js');
  const { runGit } = require('../dist/git/runGit.js');
  const fsp = require('fs').promises;
  const path = require('path');

  const toIngest = [
    'https://github.com/aiken-lang/aiken',
    'https://github.com/aiken-lang/site'
  ];

  const added = [];
  const skipped = [];
  const errors = [];

  for (const u of toIngest) {
    console.log('Ingesting', u);
    try {
      const res = await ingestUrl(u, { category: 'documentation', maxChars: 300_000, renderJs: false, summarize: true, autoIndex: false });
      const spec = res.spec;
      if (!spec) {
        console.warn('No spec produced for', u);
        continue;
      }

      // try to add
      const r = await addCustomSource('documentation', spec);
      if (r.ok) {
        console.log('Added', spec.id, '->', r.path);
        added.push(spec.id);
        try {
          await ensureIndexExportsForCategory('documentation');
        } catch (e) {
          // ignore
        }
      } else {
        console.log('Skipped', spec.id, 'reason=', r.reason);
        skipped.push({ id: spec.id, reason: r.reason });
      }

      // remove proposal file if created to reduce noise
      if (res.proposalPath) {
        try {
          await fsp.unlink(res.proposalPath).catch(() => { });
          console.log('Removed proposal file', res.proposalPath);
        } catch (err) {
          // ignore
        }
      }
    } catch (err) {
      console.error('Failed to ingest', u, String(err));
      errors.push({ url: u, error: String(err) });
    }
  }

  if (added.length) {
    console.log('Staging changes for commit');
    const add = await runGit({ cwd: process.cwd(), args: ['add', '.'] });
    if (!add.ok) {
      console.error('git add failed', add.error || add.stderr);
      process.exit(2);
    }

    const msg = `chore: add ingested knowledge sources: ${added.join(',')}`;
    const commit = await runGit({ cwd: process.cwd(), args: ['commit', '-m', msg] });
    if (commit.ok) {
      console.log('Committed changes:', commit.stdout.trim());
    } else {
      console.warn('Commit returned non-ok (maybe no changes):', commit.error || commit.stderr);
    }
  } else {
    console.log('No new sources added; skipping commit');
  }

  console.log('Done. added=', added, 'skipped=', skipped, 'errors=', errors);
})();

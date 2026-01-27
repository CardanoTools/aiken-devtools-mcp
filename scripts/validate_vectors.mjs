#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const dir = path.join(process.cwd(), 'var', 'vectors');

async function main() {
  try {
    const files = await fs.readdir(dir).catch(() => []);
    const jsonl = files.filter(f => f.endsWith('.jsonl'));
    if (jsonl.length === 0) {
      console.error('No vector files found in', dir);
      process.exit(2);
    }

    let failed = false;
    for (const f of jsonl) {
      const p = path.join(dir, f);
      const raw = await fs.readFile(p, 'utf8').catch(() => '');
      const lines = raw.split('\n').filter(Boolean);
      console.log(`${f}: ${lines.length} vectors`);
      if (lines.length === 0) {
        console.error(`File ${f} has 0 vectors`);
        failed = true;
        continue;
      }
      try {
        const sample = JSON.parse(lines[0]);
        const provider = sample?.metadata?.provider ?? 'unknown';
        if (process.env.FAIL_ON_PSEUDO === 'true' && provider === 'pseudo') {
          console.error(`File ${f} uses pseudo embeddings; FAIL_ON_PSEUDO is set`);
          failed = true;
        } else if (provider === 'pseudo') {
          console.warn(`File ${f} uses pseudo embeddings (ok unless FAIL_ON_PSEUDO=true)`);
        } else {
          console.log(`Provider for ${f}: ${provider}`);
        }
      } catch (err) {
        console.warn(`Could not parse sample line for ${f}:`, String(err));
      }
    }

    if (failed) process.exit(2);
    console.log('Vector validation: OK');
    process.exit(0);
  } catch (err) {
    console.error('Validation failed:', String(err));
    process.exit(2);
  }
}

main();

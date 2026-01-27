#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');

const RAW_URL = 'https://raw.githubusercontent.com/aiken-lang/awesome-aiken/main/README.md';

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/https?:\/\/|www\.|github\.com\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function mapSectionToCategory(sec) {
  const s = sec.toLowerCase();
  if (s.includes('library') || s.includes('libraries') || s.includes('cryptography') || s.includes('testing') || s.includes('infrastructure') || s.includes('data-structures')) return 'library';
  if (s.includes('tutorial') || s.includes('example') || s.includes('dapps') || s.includes('de-fi') || s.includes('defi') || s.includes('games') || s.includes('marketplace') || s.includes('smart wallet') || s.includes('misc')) return 'example';
  if (s.includes('video') || s.includes('book') || s.includes('course') || s.includes('docs') || s.includes('documentation')) return 'documentation';
  // fallback
  return 'documentation';
}

function parseReadme(md) {
  const lines = md.split(/\r?\n/);
  let currentSection = '';
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const h = line.match(/^#{2,}\s*(.*)/);
    if (h) {
      currentSection = h[1].trim();
      continue;
    }

    // match markdown link(s)
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let m;
    let found = false;
    while ((m = linkRegex.exec(line)) !== null) {
      found = true;
      const [full, text, url] = m;
      // description: remaining text after this link on same line (after the last ')')
      const after = line.slice(m.index + full.length).trim();
      let description = '';
      if (after.startsWith('-') || after.startsWith('–') || after.startsWith(':')) {
        description = after.replace(/^[-–:]+\s*/, '').trim();
      } else if (after.length > 0) {
        description = after;
      } else {
        // try to peek next line which might be continuation
        const next = (lines[i + 1] || '').trim();
        if (next && !next.startsWith('-') && !next.startsWith('#')) {
          description = next;
        }
      }

      items.push({ section: currentSection || 'misc', text, url, description });
    }

    // if line starts with '-' and had no link, try to capture following lines joined (skip)
  }

  return items;
}

function toSpec(item, usedIds) {
  const url = item.url;
  const text = item.text;
  const desc = item.description || '';

  // default
  const spec = {
    id: slugify(text || url),
    remoteUrl: url,
    defaultRef: 'main',
    folderName: slugify(text || url),
    subPath: undefined,
    description: desc || text,
    category: mapSectionToCategory(item.section)
  };

  // if github repo
  const gh = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/#?]+)(?:[\/\#].*)?$/i);
  if (gh) {
    const owner = gh[1];
    const repo = gh[2];
    spec.remoteUrl = `https://github.com/${owner}/${repo}.git`;
    spec.folderName = `${owner}-${repo}`;
    spec.id = slugify(`${owner}-${repo}`);
    // check for blob/tree path in raw url
    const blob = url.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(?:blob|tree)\/([^\/]+)\/(.*)$/i);
    if (blob) {
      const sub = blob[4];
      spec.subPath = sub.replace(/(^\/|\/$)/g, '');
    }
  } else {
    // if link is aiken-lang.org, derive folder name 'aiken-site' and set subPath
    const ak = url.match(/^https?:\/\/aiken-lang\.org\/(.*)$/i);
    if (ak) {
      spec.remoteUrl = 'https://github.com/aiken-lang/site.git';
      spec.folderName = 'aiken-site';
      spec.id = slugify(ak[1] || 'aiken-site');
      spec.subPath = ak[1] ? ak[1].replace(/(^\/|\/$)/g, '') : undefined;
    }
  }

  // ensure unique id
  let id = spec.id;
  let idx = 1;
  while (usedIds.has(id)) {
    idx += 1;
    id = `${spec.id}-${idx}`;
  }
  spec.id = id;
  usedIds.add(id);

  return spec;
}

async function main() {
  console.log('Fetching Awesome Aiken README...');
  const md = await fetchRaw(RAW_URL);
  const items = parseReadme(md);

  const usedIds = new Set();
  const specs = items.map(it => toSpec(it, usedIds));

  // Partition by category
  const byCat = {
    documentation: specs.filter(s => s.category === 'documentation'),
    library: specs.filter(s => s.category === 'library'),
    example: specs.filter(s => s.category === 'example')
  };

  // emit TypeScript
  const outDir = path.join(__dirname, '..', 'src', 'knowledge', 'awesome');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'awesomeAiken.ts');

  const header = `// THIS FILE IS GENERATED BY scripts/import-awesome-aiken.js
// Run this script to refresh from https://github.com/aiken-lang/awesome-aiken
import { KnowledgeSourceSpec } from "../types.js";

`;

  function emitArray(name, arr) {
    const items = arr.map(s => {
      const fields = [];
      fields.push(`id: \"${s.id}\"`);
      fields.push(`remoteUrl: \"${s.remoteUrl}\"`);
      fields.push(`defaultRef: \"${s.defaultRef}\"`);
      fields.push(`folderName: \"${s.folderName}\"`);
      if (s.subPath) fields.push(`subPath: \"${s.subPath}\"`);
      fields.push(`description: \"${s.description.replace(/\"/g, '\\"')}\"`);
      fields.push(`category: \"${s.category}\"`);
      return `  { ${fields.join(', ')} }`;
    }).join(',\n');

    return `export const ${name}: KnowledgeSourceSpec[] = [\n${items}\n];\n`;
  }

  const parts = [];
  parts.push(emitArray('AWESOME_AIKEN_DOCUMENTATION_SOURCES', byCat.documentation));
  parts.push(emitArray('AWESOME_AIKEN_LIBRARY_SOURCES', byCat.library));
  parts.push(emitArray('AWESOME_AIKEN_EXAMPLE_SOURCES', byCat.example));

  parts.push('\nexport const AWESOME_AIKEN_SOURCES: KnowledgeSourceSpec[] = [\n  ...AWESOME_AIKEN_DOCUMENTATION_SOURCES,\n  ...AWESOME_AIKEN_LIBRARY_SOURCES,\n  ...AWESOME_AIKEN_EXAMPLE_SOURCES\n];\n');

  fs.writeFileSync(outPath, header + parts.join('\n'));
  console.log('Wrote', outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * talent.ai rebrand audit (Phase 0.3)
 *
 * Fails when legacy product names leak into shipped code. Documentation that
 * intentionally describes the migration (TODO.md, Readme.md, brand guidelines)
 * and this script itself are excluded.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TARGETS = ['apps', 'packages', 'services', 'infrastructure', 'scripts', 'candidate', 'hr'];
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'build', '.turbo', 'coverage', '.git', '.vite']);
const EXCLUDED_FILES = new Set(['audit-rebrand.mjs', 'package-lock.json', 'pnpm-lock.yaml']);
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.css', '.md',
  '.yml', '.yaml', '.svg', '.txt', '.example',
]);

const PATTERNS = [
  { name: 'Smart Match', regex: /\bSmart[\s-]?Match\b/g },
  { name: 'SmartMatch', regex: /\bSmartMatch\b/g },
  { name: 'smartmatch', regex: /\bsmartmatch\b/g },
  { name: 'smart-match', regex: /\bsmart-match\b/g },
  { name: 'Jobify', regex: /\bJobify\b/g },
  { name: 'Filterify', regex: /\bFilterify\b/g },
];

function isTextFile(path) {
  const file = basename(path);
  if (file === 'Dockerfile' || file.startsWith('.env')) return true;
  return TEXT_EXTENSIONS.has(extname(path));
}

function* walk(directory) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry)) yield* walk(fullPath);
    } else if (!EXCLUDED_FILES.has(entry) && isTextFile(fullPath)) {
      yield fullPath;
    }
  }
}

const findings = [];

for (const target of TARGETS) {
  const directory = join(ROOT, target);
  let exists = true;
  try {
    statSync(directory);
  } catch {
    exists = false;
  }
  if (!exists) continue;

  for (const file of walk(directory)) {
    const contents = readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(contents)) !== null) {
        const line = contents.slice(0, match.index).split('\n').length;
        findings.push({
          file: relative(ROOT, file),
          line,
          match: match[0],
          pattern: pattern.name,
        });
      }
    }
  }
}

if (findings.length === 0) {
  console.log('✅ Rebrand audit passed — no legacy brand terms in shipped code.');
  process.exit(0);
}

console.error(`❌ Rebrand audit found ${findings.length} legacy brand reference(s):\n`);
for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}  "${finding.match}"  (${finding.pattern})`);
}
console.error('\nReplace legacy names with the talent.ai vocabulary (see docs/BRAND_GUIDELINES.md).');
process.exit(1);

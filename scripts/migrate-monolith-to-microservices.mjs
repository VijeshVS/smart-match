#!/usr/bin/env node
/**
 * Phase 10.1 — Monolith → microservices data migration.
 *
 * Intentionally a stub during Phase 0. It documents the migration contract and
 * exits non-zero so the pipeline never treats an unimplemented migration as a
 * successful seed.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = `${ROOT}/candidate/backend/data.json`;

console.error('talent.ai data migration is not implemented yet (planned for Phase 10.1).');
console.error(`Source dataset discovered: ${existsSync(SOURCE) ? 'yes' : 'no'} (${SOURCE})`);
console.error('Planned steps: auth users → talent profiles → engagement records → recruiter wallets.');
process.exit(1);

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serviceDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceDir = path.join(serviceDir, 'src/generated/prisma');
const targetDir = path.join(serviceDir, 'dist/generated/prisma');

// `tsc` only emits JavaScript. Prisma's native query engine must be copied next
// to the generated client because it is loaded relative to `client.js`.
const runtimeFiles = (await readdir(sourceDir)).filter(
  (entry) => entry.endsWith('.node') || entry.endsWith('.wasm'),
);

if (runtimeFiles.length === 0) {
  throw new Error(`No Prisma runtime files found in ${sourceDir}`);
}

await mkdir(targetDir, { recursive: true });
await Promise.all(
  runtimeFiles.map((entry) => copyFile(path.join(sourceDir, entry), path.join(targetDir, entry))),
);

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

const serviceDir = path.dirname(fileURLToPath(import.meta.url));

// Allow `prisma` commands to work from the service directory while sharing the
// repository root `.env` used by the running services.
dotenv.config({
  path: [path.join(serviceDir, '.env'), path.join(serviceDir, '../../.env')],
});

export default defineConfig({
  schema: path.join(serviceDir, 'prisma/schema.prisma'),
  migrations: {
    path: path.join(serviceDir, 'prisma/migrations'),
  },
});

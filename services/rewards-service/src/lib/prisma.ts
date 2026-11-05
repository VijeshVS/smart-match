import { PrismaClient } from '../generated/prisma/client.js';
import { config } from '../config.js';

export const prisma = new PrismaClient({
  datasources: {
    db: { url: config.databaseUrl },
  },
  log: config.isProduction ? ['error'] : ['warn', 'error'],
});

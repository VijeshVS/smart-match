import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

export const prisma = new PrismaClient({
  log: config.isProduction ? ['error'] : ['warn', 'error'],
});

export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

import { Prisma, type PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

type DbClient = Prisma.TransactionClient | PrismaClient;

export interface AuditLogInput {
  userId?: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Writes an immutable audit entry. Callers inside a business transaction should
 * pass the transaction client so the entry commits atomically.
 */
export async function writeAuditLog(db: DbClient, input: AuditLogInput): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata,
    },
  });
}

/** Best-effort audit for failed authentication attempts. */
export async function writeAuditLogSafe(db: DbClient, input: AuditLogInput): Promise<void> {
  try {
    await writeAuditLog(db, input);
  } catch (error) {
    logger.error({ err: error, action: input.action }, 'failed to write audit log');
  }
}

import { getCorrelationId } from '@talent-ai/logger';
import type { EventBus } from '@talent-ai/event-bus';
import type { EventDataMap, EventType } from '@talent-ai/shared-types';
import { Prisma, type OutboxEvent } from '../generated/prisma/client.js';
import { config } from '../config.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

export interface EnqueueOutboxInput {
  eventType: EventType;
  aggregateId: string;
  payload: Prisma.InputJsonValue;
  correlationId?: string;
}

/**
 * Adds an event to the outbox. Must be called with the same transaction client
 * as the business mutation so both commit or roll back together.
 */
export async function enqueueOutbox(
  tx: Prisma.TransactionClient,
  input: EnqueueOutboxInput,
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      eventType: input.eventType,
      aggregateId: input.aggregateId,
      payload: input.payload,
      correlationId: input.correlationId ?? getCorrelationId() ?? undefined,
    },
  });
}

async function claimBatch(): Promise<OutboxEvent[]> {
  return prisma.$transaction(async (tx) => {
    // Recover rows whose relay process died between claim and publish.
    await tx.$executeRaw`
      UPDATE outbox_events
      SET status = 'PENDING', updated_at = NOW()
      WHERE status = 'PROCESSING'
        AND updated_at < NOW() - INTERVAL '2 minutes'
    `;

    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM outbox_events
      WHERE status IN ('PENDING', 'FAILED')
        AND available_at <= NOW()
        AND attempts < ${config.outbox.maxAttempts}
      ORDER BY created_at ASC
      LIMIT ${config.outbox.batchSize}
      FOR UPDATE SKIP LOCKED
    `;

    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);
    await tx.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PROCESSING' },
    });

    return tx.outboxEvent.findMany({ where: { id: { in: ids } } });
  });
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}

/**
 * Relays one batch of outbox rows to RabbitMQ. Exported for tests and for a
 * manual drain operation.
 */
export async function relayOutboxOnce(eventBus: EventBus): Promise<number> {
  if (!eventBus.isConnected) {
    try {
      await eventBus.connect();
    } catch (error) {
      logger.debug({ err: error }, 'outbox relay waiting for RabbitMQ');
      return 0;
    }
  }

  const rows = await claimBatch();
  if (rows.length === 0) return 0;

  let published = 0;

  for (const row of rows) {
    try {
      await eventBus.publish(
        row.eventType as EventType,
        row.aggregateId,
        row.payload as unknown as EventDataMap[EventType],
        { correlationId: row.correlationId ?? undefined },
      );

      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      published += 1;
    } catch (error) {
      const attempts = row.attempts + 1;
      const exhausted = attempts >= config.outbox.maxAttempts;
      const backoffMs = Math.min(1_000 * 2 ** Math.min(attempts, 6), 60_000);

      await prisma.outboxEvent.update({
        where: { id: row.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts,
          lastError: errorMessage(error),
          availableAt: new Date(Date.now() + backoffMs),
        },
      });

      logger.warn(
        {
          err: error,
          eventId: row.id,
          eventType: row.eventType,
          attempts,
          exhausted,
        },
        'outbox event publication failed',
      );
    }
  }

  return published;
}

/**
 * Starts the polling relay. Returns an idempotent stop function.
 */
export function startOutboxRelay(eventBus: EventBus): () => void {
  let stopped = false;
  let running = false;
  let timer: NodeJS.Timeout | undefined;

  const tick = (): void => {
    if (stopped || running) return;
    running = true;

    void relayOutboxOnce(eventBus)
      .catch((error: unknown) => {
        logger.error({ err: error }, 'outbox relay tick failed');
      })
      .finally(() => {
        running = false;
        if (!stopped) {
          timer = setTimeout(tick, config.outbox.pollIntervalMs);
          timer.unref?.();
        }
      });
  };

  timer = setTimeout(tick, 0);
  timer.unref?.();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
}

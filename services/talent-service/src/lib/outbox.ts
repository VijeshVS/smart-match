import type { ClientSession } from 'mongoose';
import type { EventBus } from '@talent-ai/event-bus';
import type { EventDataMap, EventType } from '@talent-ai/shared-types';
import { config } from '../config.js';
import type { OutboxEventDocument } from '../models/outbox-event.model.js';
import { OutboxEventModel } from '../models/outbox-event.model.js';
import { logger } from './logger.js';

export interface EnqueueOutboxInput {
  eventType: EventType;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Adds an event to the outbox using the same Mongo session as the profile
 * mutation, so the profile write and the event record commit atomically.
 */
export async function enqueueOutbox(
  session: ClientSession,
  input: EnqueueOutboxInput,
): Promise<void> {
  await OutboxEventModel.create(
    [
      {
        eventType: input.eventType,
        aggregateId: input.aggregateId,
        payload: input.payload,
        correlationId: input.correlationId,
      },
    ],
    { session },
  );
}

const STUCK_AFTER_MS = 2 * 60 * 1_000;

/**
 * Atomically claims up to `batchSize` pending/failed events. `findOneAndUpdate`
 * makes the claim safe when several relay replicas run concurrently.
 */
async function claimBatch(): Promise<OutboxEventDocument[]> {
  await OutboxEventModel.updateMany(
    {
      status: 'PROCESSING',
      updatedAt: { $lt: new Date(Date.now() - STUCK_AFTER_MS) },
    },
    { $set: { status: 'PENDING' } },
  );

  const claimed: OutboxEventDocument[] = [];
  const now = new Date();

  for (let index = 0; index < config.outbox.batchSize; index += 1) {
    const event = await OutboxEventModel.findOneAndUpdate(
      {
        status: { $in: ['PENDING', 'FAILED'] },
        availableAt: { $lte: now },
        attempts: { $lt: config.outbox.maxAttempts },
      },
      { $set: { status: 'PROCESSING' } },
      { sort: { createdAt: 1 }, new: true },
    );

    if (!event) break;
    claimed.push(event);
  }

  return claimed;
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

  const events = await claimBatch();
  if (events.length === 0) return 0;

  let published = 0;

  for (const event of events) {
    try {
      await eventBus.publish(
        event.eventType as EventType,
        event.aggregateId,
        event.payload as unknown as EventDataMap[EventType],
        { correlationId: event.correlationId },
      );

      await OutboxEventModel.updateOne(
        { _id: event._id },
        {
          $set: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
          $inc: { attempts: 1 },
          $unset: { lastError: 1 },
        },
      );
      published += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      const exhausted = attempts >= config.outbox.maxAttempts;
      const backoffMs = Math.min(1_000 * 2 ** Math.min(attempts, 6), 60_000);

      await OutboxEventModel.updateOne(
        { _id: event._id },
        {
          $set: {
            status: exhausted ? 'FAILED' : 'PENDING',
            attempts,
            lastError: errorMessage(error),
            availableAt: new Date(Date.now() + backoffMs),
          },
        },
      );

      logger.warn(
        {
          err: error,
          eventId: event._id.toString(),
          eventType: event.eventType,
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

import { setTimeout as sleep } from 'node:timers/promises';
import type { DomainEvent } from '@talent-ai/shared-types';
import { EVENT_QUEUES } from '@talent-ai/shared-types';
import { embeddingProvider } from '../ai/embedding.js';
import { buildEmbeddingText, profileFromEvent, profileNeedsReindex } from '../ai/profile.js';
import type { AiProfile } from '../ai/types.js';
import { eventBus } from '../lib/event-bus.js';
import { logger } from '../lib/logger.js';
import { qdrant } from '../lib/qdrant.js';
import { talentProfileEventSchema } from '../validation/ai.schemas.js';

const MAX_UPSERT_ATTEMPTS = 3;

async function upsertWithRetry(profile: AiProfile, vector: number[]): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_UPSERT_ATTEMPTS; attempt += 1) {
    try {
      await qdrant.upsert(profile, vector);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_UPSERT_ATTEMPTS) {
        await sleep(250 * 2 ** (attempt - 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Indexes a candidate profile into Qdrant. The event bus delivers at least
 * once; the deterministic point id makes repeated deliveries idempotent.
 */
export async function handleTalentProfileEvent(event: DomainEvent<unknown>): Promise<void> {
  const parsed = talentProfileEventSchema.safeParse(event.data);

  if (!parsed.success) {
    throw new Error(
      `${event.eventType} payload failed validation: ${JSON.stringify(parsed.error.flatten())}`,
    );
  }

  if (
    event.eventType === 'talent.profile.updated' &&
    !profileNeedsReindex(parsed.data.changedFields)
  ) {
    logger.debug(
      { eventId: event.eventId, talentId: parsed.data.talentId },
      'talent update did not touch indexed fields; skipping re-embedding',
    );
    return;
  }

  const profile = profileFromEvent(parsed.data);
  const vector = await embeddingProvider.embed(buildEmbeddingText(profile), 'document');

  await upsertWithRetry(profile, vector);

  logger.info(
    {
      eventId: event.eventId,
      eventType: event.eventType,
      talentId: profile.talentId,
      dimensions: vector.length,
      embeddingProvider: embeddingProvider.name,
    },
    'talent profile indexed',
  );
}

/** Registers the durable talent-indexer consumer. */
export async function startTalentIndexer(): Promise<void> {
  await eventBus.subscribe({
    queue: EVENT_QUEUES.aiTalentIndexer,
    routingKeys: ['talent.profile.created', 'talent.profile.updated'],
    prefetch: 5,
    handler: (event) => handleTalentProfileEvent(event),
  });

  logger.info(
    {
      queue: EVENT_QUEUES.aiTalentIndexer,
      routingKeys: ['talent.profile.created', 'talent.profile.updated'],
    },
    'talent indexer consumer registered',
  );
}

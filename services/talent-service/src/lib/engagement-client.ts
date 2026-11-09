import { getCorrelationId } from '@talent-ai/logger';
import { z } from 'zod';
import { config } from '../config.js';
import type { TalentPrincipal } from '../middleware/auth.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

const exclusionsResponseSchema = z.object({
  data: z.object({
    recruiterId: z.string().uuid(),
    talentIds: z.array(z.string().uuid()),
  }),
});

/**
 * Loads the candidate ids the recruiter already screened from engagement-service.
 *
 * The call fails closed: if engagement is unavailable the blind queue refuses to
 * render rather than showing candidates that may already have been reviewed.
 */
export async function fetchRecruiterQueueExclusions(
  principal: TalentPrincipal,
  authorization?: string,
): Promise<string[]> {
  const endpoint = `${config.engagement.url}/api/v1/engagement/recruiter/${encodeURIComponent(
    principal.userId,
  )}/exclusions`;
  const correlationId = getCorrelationId();

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-user-id': principal.userId,
        'x-user-email': principal.email,
        'x-user-role': principal.role,
        ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
        ...(authorization ? { authorization } : {}),
      },
      signal: AbortSignal.timeout(config.engagement.timeoutMs),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError(
        503,
        'ENGAGEMENT_UNAVAILABLE',
        'Previously reviewed candidates could not be checked. Please try again shortly.',
        {
          expose: true,
          details: { status: response.status, body: body.slice(0, 500) },
        },
      );
    }

    const payload = exclusionsResponseSchema.parse(await response.json());
    if (payload.data.recruiterId !== principal.userId) {
      throw new AppError(
        503,
        'ENGAGEMENT_RESPONSE_INVALID',
        'Previously reviewed candidates could not be checked. Please try again shortly.',
        { expose: true },
      );
    }

    return payload.data.talentIds;
  } catch (error) {
    if (error instanceof AppError) {
      logger.error(
        { err: error, endpoint, recruiterId: principal.userId },
        'engagement exclusions request failed',
      );
      throw error;
    }

    logger.error(
      { err: error, endpoint, recruiterId: principal.userId },
      'engagement exclusions request failed',
    );
    throw new AppError(
      503,
      'ENGAGEMENT_UNAVAILABLE',
      'Previously reviewed candidates could not be checked. Please try again shortly.',
      { cause: error, expose: true },
    );
  }
}

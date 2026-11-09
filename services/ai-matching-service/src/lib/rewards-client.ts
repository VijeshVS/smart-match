import { getCorrelationId } from '@talent-ai/logger';
import { TALENT_CREDIT_RULES, type Wallet } from '@talent-ai/shared-types';
import { z } from 'zod';
import { config } from '../config.js';
import type { AiPrincipal } from '../middleware/auth.js';
import { AppError } from './errors.js';
import { logger } from './logger.js';

const walletSchema = z.object({
  id: z.string(),
  recruiterId: z.string(),
  balance: z.number().int(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const chargeResponseSchema = z.object({
  data: z.object({
    wallet: walletSchema,
    charged: z.boolean(),
    chargedCredits: z.number().int().nonnegative(),
  }),
});

const refundResponseSchema = z.object({
  data: z.object({
    wallet: walletSchema,
    refunded: z.boolean(),
    refundedCredits: z.number().int().nonnegative(),
  }),
});

const errorResponseSchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
      details: z.unknown().optional(),
    })
    .optional(),
});

export interface TalentLensCharge {
  wallet: Wallet;
  charged: boolean;
  chargedCredits: number;
}

function internalHeaders(principal: AiPrincipal, authorization?: string): Record<string, string> {
  const correlationId = getCorrelationId();
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    'x-user-id': principal.userId,
    'x-user-email': principal.email,
    'x-user-role': principal.role,
    ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    ...(authorization ? { authorization } : {}),
  };
}

async function post<T>(
  path: string,
  body: unknown,
  principal: AiPrincipal,
  authorization: string | undefined,
  schema: z.ZodType<T>,
  unavailableMessage: string,
): Promise<T> {
  const endpoint = `${config.rewards.url}/api/v1/rewards${path}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: internalHeaders(principal, authorization),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.rewards.timeoutMs),
    });

    if (!response.ok) {
      const payload = errorResponseSchema.parse(await response.json().catch(() => ({})));
      const code = payload.error?.code;
      const message = payload.error?.message;

      if (response.status === 402 || code === 'INSUFFICIENT_CREDITS') {
        throw new AppError(
          402,
          'INSUFFICIENT_CREDITS',
          message ??
            `A TalentLens search requires ${TALENT_CREDIT_RULES.TALENT_LENS_QUERY_COST} TalentCredits`,
          { details: payload.error?.details },
        );
      }

      if (response.status === 403) {
        throw new AppError(403, 'FORBIDDEN', message ?? 'You do not have access to this wallet');
      }

      throw new AppError(503, 'REWARDS_UNAVAILABLE', unavailableMessage, {
        expose: true,
        details: { status: response.status, code },
      });
    }

    return schema.parse(await response.json());
  } catch (error) {
    if (error instanceof AppError) {
      logger.error(
        { err: error, endpoint, recruiterId: principal.userId },
        'rewards request failed',
      );
      throw error;
    }

    logger.error({ err: error, endpoint, recruiterId: principal.userId }, 'rewards request failed');
    throw new AppError(503, 'REWARDS_UNAVAILABLE', unavailableMessage, {
      cause: error,
      expose: true,
    });
  }
}

/** Debits the recruiter for one TalentLens query (idempotent on `queryId`). */
export async function chargeTalentLensQuery(
  principal: AiPrincipal,
  queryId: string,
  authorization?: string,
): Promise<TalentLensCharge> {
  const payload = await post(
    '/talent-lens/charge',
    { queryId },
    principal,
    authorization,
    chargeResponseSchema,
    'TalentCredits could not be verified. Please try again shortly.',
  );

  return payload.data;
}

/** Reverses a TalentLens charge when the search fails after the debit. */
export async function refundTalentLensQuery(
  principal: AiPrincipal,
  queryId: string,
  authorization?: string,
): Promise<void> {
  await post(
    '/talent-lens/refund',
    { queryId },
    principal,
    authorization,
    refundResponseSchema,
    'The TalentLens charge could not be reversed. Support can reconcile your wallet.',
  );
}

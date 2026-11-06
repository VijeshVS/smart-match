import type { ProfileSummaryResult } from '@talent-ai/shared-types';
import { z } from 'zod';
import { localSummary } from '../ai/fallback.js';
import { llm } from '../ai/llm.js';
import { SUMMARY_SYSTEM, summaryPrompt } from '../ai/prompts.js';
import { config } from '../config.js';
import type { ProfileSummaryInput } from '../validation/ai.schemas.js';
import { cacheKey, responseCache } from './cache.js';
import { resolveProfile } from './profile-resolver.js';

const summarySchema = z.object({
  summary: z.array(z.string().trim().min(1).max(300)).min(1).max(8),
});

export async function summarizeProfile(input: ProfileSummaryInput): Promise<ProfileSummaryResult> {
  const profile = await resolveProfile(input);
  const key = cacheKey('summary', { profile, provider: llm.provider });

  const cached = await responseCache.get<Omit<ProfileSummaryResult, 'cached'>>(key);
  if (cached) {
    return { ...cached, cached: true };
  }

  const answer = await llm.generateJson({
    system: SUMMARY_SYSTEM,
    prompt: summaryPrompt(profile),
    schema: summarySchema,
    fallback: () => ({ summary: localSummary(profile) }),
    temperature: 0.2,
    maxTokens: 700,
  });

  const result = {
    summary: answer.value.summary
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6),
    provider: answer.provider,
    fallback: answer.fallback,
  };

  await responseCache.set(key, result, config.ai.cacheTtlSeconds);
  return { ...result, cached: false };
}

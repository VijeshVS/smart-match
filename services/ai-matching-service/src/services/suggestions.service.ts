import type { ProfileSuggestionsResult } from '@talent-ai/shared-types';
import { z } from 'zod';
import { localSuggestions } from '../ai/fallback.js';
import { llm } from '../ai/llm.js';
import { SUGGESTIONS_SYSTEM, suggestionsPrompt } from '../ai/prompts.js';
import { config } from '../config.js';
import type { ProfileSuggestionsInput } from '../validation/ai.schemas.js';
import { cacheKey, responseCache } from './cache.js';
import { resolveProfile } from './profile-resolver.js';

const suggestionsSchema = z.object({
  suggestions: z.array(z.string().trim().min(1).max(400)).min(1).max(10),
});

export async function suggestImprovements(
  input: ProfileSuggestionsInput,
): Promise<ProfileSuggestionsResult> {
  const profile = await resolveProfile(input);
  const reviews = input.reviews ?? [];
  const key = cacheKey('suggestions', { profile, reviews, provider: llm.provider });

  const cached = await responseCache.get<Omit<ProfileSuggestionsResult, 'cached'>>(key);
  if (cached) {
    return { ...cached, cached: true };
  }

  const answer = await llm.generateJson({
    system: SUGGESTIONS_SYSTEM,
    prompt: suggestionsPrompt(profile, reviews),
    schema: suggestionsSchema,
    fallback: () => ({ suggestions: localSuggestions(profile, reviews) }),
    temperature: 0.3,
    maxTokens: 900,
  });

  const result = {
    suggestions: answer.value.suggestions
      .map((suggestion) => suggestion.trim())
      .filter(Boolean)
      .slice(0, 8),
    provider: answer.provider,
    fallback: answer.fallback,
  };

  await responseCache.set(key, result, config.ai.cacheTtlSeconds);
  return { ...result, cached: false };
}

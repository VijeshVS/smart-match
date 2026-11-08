import { randomUUID } from 'node:crypto';
import { getCorrelationId } from '@talent-ai/logger';
import { getServiceMetrics } from '@talent-ai/observability/metrics';
import type {
  AiEngine,
  TalentLevel,
  TalentLensFilters,
  TalentLensMatch,
  TalentLensResponse,
} from '@talent-ai/shared-types';
import { z } from 'zod';
import { embeddingProvider } from '../ai/embedding.js';
import { extractQueryFilters, localRerank } from '../ai/fallback.js';
import { llm } from '../ai/llm.js';
import { QUERY_SYSTEM, RERANK_SYSTEM, queryPrompt, rerankPrompt } from '../ai/prompts.js';
import type { QueryInterpretation, SearchHit } from '../ai/types.js';
import { config } from '../config.js';
import { mapWithConcurrency } from '../lib/concurrency.js';
import { AppError } from '../lib/errors.js';
import { eventBus } from '../lib/event-bus.js';
import { logger } from '../lib/logger.js';
import { qdrant } from '../lib/qdrant.js';
import type { AiPrincipal } from '../middleware/auth.js';
import { talentLensFiltersSchema, type TalentLensInput } from '../validation/ai.schemas.js';
import { cacheKey, responseCache } from './cache.js';

const { domain } = getServiceMetrics(config.serviceName);

const queryInterpretationSchema = z.object({
  semanticQuery: z.string().trim().min(1).max(4_000),
  filters: talentLensFiltersSchema.optional(),
});

const rerankSchema = z.object({
  score: z
    .number()
    .finite()
    .transform((value) => (value > 1 ? value / 100 : value))
    .pipe(z.number().min(0).max(1)),
  matchedSkills: z.array(z.string().max(80)).max(30).default([]),
  strengths: z.array(z.string().max(160)).max(10).default([]),
  rationale: z.string().max(500).default(''),
});

const LEVEL_KEYWORDS: ReadonlyArray<[RegExp, TalentLevel]> = [
  [/\b(entry|junior|graduate|intern|level\s*1)\b/i, 'LEVEL_1_ENTRY'],
  [/\b(mid|mid-level|intermediate|senior|level\s*2)\b/i, 'LEVEL_2_MID'],
  [/\b(staff|principal|lead|elite|level\s*3)\b/i, 'LEVEL_3_LEAD'],
];

/**
 * Language models tend to copy the example level from the prompt and apply it
 * to every query, which silently filters out valid candidates. Only trust an
 * inferred level when the recruiter actually named a seniority, and normalise
 * the common synonyms to the platform's three tiers.
 */
function normalizeInferredFilters(
  query: string,
  inferred: TalentLensFilters | undefined,
): TalentLensFilters | undefined {
  if (!inferred) return inferred;

  const explicitLevel = LEVEL_KEYWORDS.find(([pattern]) => pattern.test(query));
  const rest = { ...inferred };
  delete rest.level;

  return explicitLevel ? { ...rest, level: explicitLevel[1] } : rest;
}

function mergeFilters(
  explicit: TalentLensFilters | undefined,
  inferred: TalentLensFilters | undefined,
): TalentLensFilters {
  const merged = { ...(inferred ?? {}), ...(explicit ?? {}) };
  const parsed = talentLensFiltersSchema.safeParse(merged);
  return parsed.success ? parsed.data : (explicit ?? {});
}

async function interpretQuery(
  query: string,
  explicitFilters: TalentLensFilters | undefined,
): Promise<{ interpretation: QueryInterpretation; fallback: boolean }> {
  const explicit = explicitFilters ?? {};

  const answer = await llm.generateJson({
    system: QUERY_SYSTEM,
    prompt: queryPrompt(query, explicit),
    schema: queryInterpretationSchema,
    fallback: () => extractQueryFilters(query, explicit),
    temperature: 0,
    maxTokens: 500,
  });

  return {
    interpretation: {
      semanticQuery: answer.value.semanticQuery || query,
      filters: mergeFilters(explicit, normalizeInferredFilters(query, answer.value.filters)),
    },
    fallback: answer.fallback,
  };
}

function toMatch(
  hit: SearchHit,
  rerank: {
    score: number;
    matchedSkills?: string[];
    strengths?: string[];
    rationale?: string;
  },
): TalentLensMatch {
  const finalScore = Math.min(1, Math.max(0, 0.55 * hit.score + 0.45 * rerank.score));

  return {
    talentId: hit.profile.talentId,
    profile: {
      id: hit.profile.talentId,
      name: hit.profile.name,
      field: hit.profile.field,
      skills: [...hit.profile.skills],
      experienceYears: hit.profile.experienceYears,
      level: hit.profile.level,
    },
    score: Number(finalScore.toFixed(4)),
    matchedSkills: [...new Set(rerank.matchedSkills ?? [])].slice(0, 8),
    strengths: (rerank.strengths ?? []).slice(0, 5),
    ...(rerank.rationale ? { rationale: rerank.rationale } : {}),
  };
}

async function rerankHits(
  query: string,
  hits: SearchHit[],
  filters: TalentLensFilters,
): Promise<{ matches: TalentLensMatch[]; fallback: boolean }> {
  const candidates = hits.slice(0, config.ai.maxRerank);

  const scored = await mapWithConcurrency(candidates, config.ai.maxConcurrency, async (hit) => {
    const answer = await llm.generateJson({
      system: RERANK_SYSTEM,
      prompt: rerankPrompt(query, hit.profile),
      schema: rerankSchema,
      fallback: () => localRerank(query, hit.profile, filters),
      temperature: 0,
      maxTokens: 400,
    });

    return {
      match: toMatch(hit, answer.value),
      fallback: answer.fallback,
    };
  });

  return {
    matches: scored.map((entry) => entry.match),
    fallback: scored.some((entry) => entry.fallback),
  };
}

function publishHighAffinity(principal: AiPrincipal, top: TalentLensMatch | undefined): void {
  if (!top || top.score < config.ai.highAffinityThreshold) return;

  void eventBus
    .publish(
      'ai.evaluation.completed',
      top.talentId,
      {
        evaluationId: randomUUID(),
        recruiterId: principal.userId,
        talentId: top.talentId,
        score: top.score,
        summary:
          top.rationale || top.strengths.join(', ') || `High-affinity ${top.profile.field} match`,
        timestamp: new Date().toISOString(),
      },
      { correlationId: getCorrelationId() ?? undefined },
    )
    .catch((error: unknown) => {
      logger.warn(
        { err: error, talentId: top.talentId },
        'failed to publish ai.evaluation.completed',
      );
    });
}

export async function talentLens(
  input: TalentLensInput,
  principal: AiPrincipal,
): Promise<TalentLensResponse> {
  const key = cacheKey('talent-lens', {
    query: input.query,
    limit: input.limit,
    filters: input.filters ?? {},
    provider: llm.provider,
  });

  const cached = await responseCache.get<TalentLensResponse>(key);
  if (cached) {
    return { ...cached, cached: true };
  }

  const { interpretation, fallback: interpretationFallback } = await interpretQuery(
    input.query,
    input.filters,
  );

  let vector: number[];
  try {
    vector = await embeddingProvider.embed(interpretation.semanticQuery, 'query');
  } catch (error) {
    logger.error({ err: error, provider: embeddingProvider.name }, 'query embedding failed');
    throw new AppError(
      503,
      'EMBEDDING_UNAVAILABLE',
      'The search embedding provider is temporarily unavailable',
    );
  }

  let hits: SearchHit[];
  try {
    hits = await qdrant.search(vector, {
      limit: Math.min(50, Math.max(input.limit * 3, 12)),
      filters: interpretation.filters,
    });
  } catch (error) {
    logger.error({ err: error }, 'Qdrant search failed');
    throw new AppError(
      503,
      'VECTOR_STORE_UNAVAILABLE',
      'Semantic search is temporarily unavailable',
    );
  }

  const { matches, fallback: rerankFallback } = await rerankHits(
    input.query,
    hits,
    interpretation.filters,
  );

  const results = matches
    .filter((match) => match.score >= config.ai.minMatchScore)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit);

  const fallback = interpretationFallback || rerankFallback;
  const provider: AiEngine = fallback ? 'local' : llm.provider;

  const response: TalentLensResponse = {
    query: input.query,
    results,
    cached: false,
    provider,
    fallback,
  };

  await responseCache.set(key, response, config.ai.cacheTtlSeconds);
  domain.aiTalentLensSearches.inc({ outcome: results.length > 0 ? 'success' : 'empty' });
  publishHighAffinity(principal, results[0]);

  logger.info(
    {
      query: input.query,
      returned: results.length,
      candidates: hits.length,
      filters: interpretation.filters,
      provider,
      fallback,
    },
    'talent lens search completed',
  );

  return response;
}

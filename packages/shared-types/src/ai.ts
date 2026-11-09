import type { ISODateString, UUID } from './common.js';
import type { Wallet } from './rewards.js';
import type { TalentLevel, TalentProfile } from './talent.js';

export const LLM_PROVIDERS = ['groq', 'gemini', 'openai'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

/**
 * Every engine the AI service can answer with. `local` is the deterministic
 * fallback used when no provider key is configured or a provider circuit is
 * open, so responses never fail solely because of a rate limit.
 */
export const AI_ENGINES = [...LLM_PROVIDERS, 'local'] as const;
export type AiEngine = (typeof AI_ENGINES)[number];

/**
 * Minimal profile snapshot accepted by the summary / suggestion endpoints.
 * Callers may send the profile inline or let the service load the copy that
 * was indexed from `talent.profile.*` events.
 */
export type AiProfileSnapshot = Pick<
  TalentProfile,
  'name' | 'field' | 'skills' | 'experienceYears'
> &
  Partial<
    Pick<TalentProfile, 'id' | 'userId' | 'level' | 'education' | 'previousExperience' | 'bio'>
  >;

export interface ProfileSummaryRequest {
  talentId?: UUID;
  profile?: AiProfileSnapshot;
}

export interface ProfileSuggestionsRequest extends ProfileSummaryRequest {
  /** Optional review comments used to ground the recommendations. */
  reviews?: string[];
}

export interface ProfileSummaryResult {
  summary: string[];
  provider: AiEngine;
  cached: boolean;
  fallback: boolean;
}

export interface ProfileSuggestionsResult {
  suggestions: string[];
  provider: AiEngine;
  cached: boolean;
  fallback: boolean;
}

export interface TalentLensFilters {
  skills?: string[];
  level?: TalentLevel;
  minExperienceYears?: number;
  maxExperienceYears?: number;
  field?: string;
}

export interface TalentLensRequest {
  query: string;
  limit?: number;
  filters?: TalentLensFilters;
  /**
   * Client-generated idempotency key. A retried request that reuses this value
   * reuses the original debit instead of charging the recruiter twice.
   */
  requestId?: UUID;
}

export interface TalentLensMatch {
  talentId: UUID;
  profile: Pick<TalentProfile, 'id' | 'name' | 'field' | 'skills' | 'experienceYears' | 'level'>;
  /** Normalised confidence score between 0 and 1. */
  score: number;
  matchedSkills: string[];
  strengths: string[];
  rationale?: string;
}

export interface TalentLensResponse {
  query: string;
  results: TalentLensMatch[];
  cached: boolean;
  provider: AiEngine;
  /** True when the deterministic local engine produced the answer. */
  fallback: boolean;
  /** TalentCredits debited by this request (0 for an idempotent replay). */
  chargedCredits: number;
  /** Recruiter wallet after the query debit. */
  wallet: Wallet;
}

export interface MatchEvaluation {
  id: UUID;
  recruiterId: UUID;
  talentId: UUID;
  jobId?: UUID;
  score: number;
  reasoning: string[];
  provider: AiEngine;
  createdAt: ISODateString;
}

export interface CareerSuggestion {
  title: string;
  detail: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  relatedSkills: string[];
}

export interface AiEvaluationCompletedPayload {
  evaluationId: UUID;
  recruiterId: UUID;
  talentId: UUID;
  jobId?: UUID;
  score: number;
  summary: string;
  timestamp: ISODateString;
}

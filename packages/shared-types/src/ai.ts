import type { ISODateString, UUID } from './common.js';
import type { TalentLevel, TalentProfile } from './talent.js';

export const LLM_PROVIDERS = ['groq', 'gemini', 'openai'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

export interface ProfileSummaryResult {
  summary: string[];
}

export interface ProfileSuggestionsResult {
  suggestions: string[];
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
}

export interface TalentLensMatch {
  talentId: UUID;
  profile: Pick<
    TalentProfile,
    'id' | 'name' | 'field' | 'skills' | 'experienceYears' | 'level'
  >;
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
  provider: LLMProvider;
}

export interface MatchEvaluation {
  id: UUID;
  recruiterId: UUID;
  talentId: UUID;
  jobId?: UUID;
  score: number;
  reasoning: string[];
  provider: LLMProvider;
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

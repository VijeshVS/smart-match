import type {
  AiEngine,
  Education,
  LLMProvider,
  TalentLensFilters,
  TalentLevel,
  WorkExperience,
} from '@talent-ai/shared-types';

/** Denormalised profile snapshot stored in Qdrant and used by the AI prompts. */
export interface AiProfile {
  talentId: string;
  userId?: string;
  name: string;
  field: string;
  skills: string[];
  experienceYears: number;
  level: TalentLevel;
  education?: Education[];
  previousExperience?: WorkExperience[];
  bio?: string;
}

export interface LlmCompletionRequest {
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmClient {
  readonly provider: LLMProvider;
  complete(request: LlmCompletionRequest): Promise<string>;
}

export interface LlmAnswer<T> {
  value: T;
  provider: AiEngine;
  fallback: boolean;
}

export interface QueryInterpretation {
  semanticQuery: string;
  filters: TalentLensFilters;
}

export interface RerankResult {
  score: number;
  matchedSkills: string[];
  strengths: string[];
  rationale: string;
}

export interface SearchHit {
  /** Qdrant cosine similarity in the 0..1 range. */
  score: number;
  profile: AiProfile;
}

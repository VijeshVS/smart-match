import type {
  CandidateReview,
  CreateReviewRequest,
  CreateSwipeRequest,
  RecruiterEngagementHistory,
  RecruiterTalentInterest,
  SwipeInteraction,
  TalentEngagementSummary,
} from '@talent-ai/shared-types';
import { api } from '../http.js';
import { API_PREFIXES } from '../env.js';

interface Envelope<T> {
  data: T;
}

interface EnvelopeMeta {
  created?: boolean;
  updated?: boolean;
}

export interface SubmitReviewResult {
  review: CandidateReview;
  created: boolean;
  updated: boolean;
}

export const engagementApi = {
  recordSwipe: async (input: CreateSwipeRequest): Promise<SwipeInteraction> => {
    const { data } = await api.post<Envelope<SwipeInteraction>>(
      `${API_PREFIXES.engagement}/swipes`,
      input,
    );
    return data.data;
  },

  submitReview: async (input: CreateReviewRequest): Promise<SubmitReviewResult> => {
    const { data } = await api.post<Envelope<CandidateReview> & { meta?: EnvelopeMeta }>(
      `${API_PREFIXES.engagement}/reviews`,
      input,
    );
    return {
      review: data.data,
      created: data.meta?.created ?? true,
      updated: data.meta?.updated ?? false,
    };
  },

  getTalentSummary: async (talentId: string): Promise<TalentEngagementSummary> => {
    const { data } = await api.get<Envelope<TalentEngagementSummary>>(
      `${API_PREFIXES.engagement}/talent/${talentId}/summary`,
    );
    return data.data;
  },

  getRecruiterHistory: async (recruiterId: string): Promise<RecruiterEngagementHistory> => {
    const { data } = await api.get<Envelope<RecruiterEngagementHistory>>(
      `${API_PREFIXES.engagement}/recruiter/${recruiterId}/history`,
    );
    return data.data;
  },

  /** Candidates the signed-in recruiter marked as interested in TalentLens. */
  listInterests: async (): Promise<RecruiterTalentInterest[]> => {
    const { data } = await api.get<Envelope<RecruiterTalentInterest[]>>(
      `${API_PREFIXES.engagement}/interests`,
    );
    return data.data;
  },

  markInterest: async (talentId: string): Promise<RecruiterTalentInterest> => {
    const { data } = await api.post<Envelope<RecruiterTalentInterest>>(
      `${API_PREFIXES.engagement}/interests`,
      { talentId },
    );
    return data.data;
  },

  removeInterest: async (talentId: string): Promise<{ removed: boolean }> => {
    const { data } = await api.delete<Envelope<{ removed: boolean }>>(
      `${API_PREFIXES.engagement}/interests/${talentId}`,
    );
    return data.data;
  },
};

import type {
  CandidateReview,
  CreateReviewRequest,
  CreateSwipeRequest,
  RecruiterEngagementHistory,
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
};

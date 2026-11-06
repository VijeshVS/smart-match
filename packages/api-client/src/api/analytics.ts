import type {
  CandidateAnalytics,
  FunnelAggregate,
  RecruiterDashboard,
  RecruiterLeaderboardEntry,
  SkillAnalytics,
} from '@talent-ai/shared-types';
import { api } from '../http.js';
import { API_PREFIXES } from '../env.js';

interface Envelope<T> {
  data: T;
}

export const analyticsApi = {
  candidate: async (talentId: string): Promise<CandidateAnalytics> => {
    const { data } = await api.get<Envelope<CandidateAnalytics>>(
      `${API_PREFIXES.analytics}/candidate/${talentId}`,
    );
    return data.data;
  },

  recruiterDashboard: async (recruiterId?: string): Promise<RecruiterDashboard> => {
    const { data } = await api.get<Envelope<RecruiterDashboard>>(
      `${API_PREFIXES.analytics}/recruiter/dashboard`,
      { params: recruiterId ? { recruiterId } : undefined },
    );
    return data.data;
  },

  skills: async (limit = 10): Promise<SkillAnalytics[]> => {
    const { data } = await api.get<Envelope<SkillAnalytics[]>>(`${API_PREFIXES.analytics}/skills`, {
      params: { limit },
    });
    return data.data;
  },

  leaderboard: async (limit = 10): Promise<RecruiterLeaderboardEntry[]> => {
    const { data } = await api.get<Envelope<RecruiterLeaderboardEntry[]>>(
      `${API_PREFIXES.analytics}/leaderboard`,
      { params: { limit } },
    );
    return data.data;
  },

  funnel: async (): Promise<FunnelAggregate> => {
    const { data } = await api.get<Envelope<FunnelAggregate>>(`${API_PREFIXES.analytics}/funnel`);
    return data.data;
  },
};

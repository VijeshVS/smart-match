import type {
  JobPosting,
  PaginatedResult,
  RecruiterProfileContext,
  UpsertRecruiterProfileRequest,
} from '@talent-ai/shared-types';
import { api } from '../http.js';
import { API_PREFIXES } from '../env.js';

interface Envelope<T> {
  data: T;
}

export const recruiterApi = {
  upsertProfile: async (input: UpsertRecruiterProfileRequest): Promise<RecruiterProfileContext> => {
    const { data } = await api.post<Envelope<RecruiterProfileContext>>(
      `${API_PREFIXES.recruiters}/profile`,
      input,
    );
    return data.data;
  },

  getMe: async (): Promise<RecruiterProfileContext> => {
    const { data } = await api.get<Envelope<RecruiterProfileContext>>(
      `${API_PREFIXES.recruiters}/me`,
    );
    return data.data;
  },

  listJobs: async (): Promise<PaginatedResult<JobPosting>> => {
    const { data } = await api.get<PaginatedResult<JobPosting>>(`${API_PREFIXES.recruiters}/jobs`);
    return data;
  },
};

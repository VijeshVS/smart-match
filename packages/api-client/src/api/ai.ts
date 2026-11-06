import type {
  ProfileSuggestionsRequest,
  ProfileSuggestionsResult,
  ProfileSummaryRequest,
  ProfileSummaryResult,
  TalentLensRequest,
  TalentLensResponse,
} from '@talent-ai/shared-types';
import { api } from '../http.js';
import { API_PREFIXES } from '../env.js';

interface Envelope<T> {
  data: T;
}

export const aiApi = {
  summarizeProfile: async (input: ProfileSummaryRequest): Promise<ProfileSummaryResult> => {
    const { data } = await api.post<Envelope<ProfileSummaryResult>>(
      `${API_PREFIXES.ai}/summarize-profile`,
      input,
      { timeout: 45_000 },
    );
    return data.data;
  },

  suggestImprovements: async (
    input: ProfileSuggestionsRequest,
  ): Promise<ProfileSuggestionsResult> => {
    const { data } = await api.post<Envelope<ProfileSuggestionsResult>>(
      `${API_PREFIXES.ai}/suggest-improvements`,
      input,
      { timeout: 45_000 },
    );
    return data.data;
  },

  talentLens: async (input: TalentLensRequest): Promise<TalentLensResponse> => {
    const { data } = await api.post<Envelope<TalentLensResponse>>(
      `${API_PREFIXES.ai}/talent-lens`,
      input,
      { timeout: 60_000 },
    );
    return data.data;
  },
};

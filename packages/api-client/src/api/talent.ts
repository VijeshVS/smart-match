import type {
  BlindTalentProfile,
  BlindTalentQueryParams,
  CreateTalentProfileRequest,
  PaginatedResult,
  TalentLevel,
  TalentProfile,
  TalentQueryParams,
  UpdateTalentProfileRequest,
} from '@talent-ai/shared-types';
import { api } from '../http.js';
import { API_PREFIXES } from '../env.js';

interface Envelope<T> {
  data: T;
}

export const talentApi = {
  createProfile: async (input: CreateTalentProfileRequest): Promise<TalentProfile> => {
    const { data } = await api.post<Envelope<TalentProfile>>(`${API_PREFIXES.talent}/`, input);
    return data.data;
  },

  getMyProfile: async (): Promise<TalentProfile> => {
    const { data } = await api.get<Envelope<TalentProfile>>(`${API_PREFIXES.talent}/me`);
    return data.data;
  },

  getProfile: async (id: string): Promise<TalentProfile> => {
    const { data } = await api.get<Envelope<TalentProfile>>(`${API_PREFIXES.talent}/${id}`);
    return data.data;
  },

  listProfiles: async (query: TalentQueryParams = {}): Promise<PaginatedResult<TalentProfile>> => {
    const { data } = await api.get<PaginatedResult<TalentProfile>>(`${API_PREFIXES.talent}/`, {
      params: {
        ...query,
        skills: query.skills?.length ? query.skills.join(',') : undefined,
        // An explicit empty scope must be preserved so the server never falls
        // back to the global directory.
        talentIds: query.talentIds === undefined ? undefined : query.talentIds.join(','),
      },
    });
    return data;
  },

  /**
   * Blind review queue for Talent Swipe. The response never contains names,
   * contact details, tier or other identity-bearing fields.
   */
  listBlindProfiles: async (
    query: BlindTalentQueryParams = {},
  ): Promise<PaginatedResult<BlindTalentProfile>> => {
    const { data } = await api.get<PaginatedResult<BlindTalentProfile>>(
      `${API_PREFIXES.talent}/blind`,
      {
        params: {
          ...query,
          skills: query.skills?.length ? query.skills.join(',') : undefined,
        },
      },
    );
    return data;
  },

  updateProfile: async (id: string, input: UpdateTalentProfileRequest): Promise<TalentProfile> => {
    const { data } = await api.put<Envelope<TalentProfile>>(`${API_PREFIXES.talent}/${id}`, input);
    return data.data;
  },

  updateLevel: async (id: string, level: TalentLevel): Promise<TalentProfile> => {
    const { data } = await api.patch<Envelope<TalentProfile>>(
      `${API_PREFIXES.talent}/${id}/level`,
      { level },
    );
    return data.data;
  },
};

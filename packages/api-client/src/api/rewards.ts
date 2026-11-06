import type {
  UnlockTier3Request,
  UnlockTier3Response,
  WalletSummary,
} from '@talent-ai/shared-types';
import { api } from '../http.js';
import { API_PREFIXES } from '../env.js';

interface Envelope<T> {
  data: T;
}

export const rewardsApi = {
  getWallet: async (recruiterId?: string): Promise<WalletSummary> => {
    const { data } = await api.get<Envelope<WalletSummary>>(`${API_PREFIXES.rewards}/wallet`, {
      params: recruiterId ? { recruiterId } : undefined,
    });
    return data.data;
  },

  unlockTier3: async (input: UnlockTier3Request): Promise<UnlockTier3Response> => {
    const { data } = await api.post<Envelope<UnlockTier3Response>>(
      `${API_PREFIXES.rewards}/unlock-tier3`,
      input,
    );
    return data.data;
  },
};

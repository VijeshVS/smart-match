import type {
  TalentAccessGrant,
  UnlockTier3Request,
  UnlockTier3Response,
  WalletSummary,
  RewardCatalogItem,
  RewardCategory,
  RedeemRewardRequest,
  RedeemRewardResponse,
  RewardRedemption,
} from '@talent-ai/shared-types';
import { api } from '../http.js';
import { API_PREFIXES } from '../env.js';

interface Envelope<T> {
  data: T;
}

export const rewardsApi = {
  getCatalog: async (category?: RewardCategory): Promise<RewardCatalogItem[]> => {
    const { data } = await api.get<Envelope<RewardCatalogItem[]>>(
      `${API_PREFIXES.rewards}/catalog`,
      {
        params: category && category !== 'ALL' ? { category } : undefined,
      },
    );
    return data.data;
  },

  redeem: async (input: RedeemRewardRequest): Promise<RedeemRewardResponse> => {
    const { data } = await api.post<Envelope<RedeemRewardResponse>>(
      `${API_PREFIXES.rewards}/redeem`,
      input,
    );
    return data.data;
  },

  getRedemptions: async (): Promise<RewardRedemption[]> => {
    const { data } = await api.get<Envelope<RewardRedemption[]>>(
      `${API_PREFIXES.rewards}/redemptions`,
    );
    return data.data;
  },

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

  /** Active Elite access grants for the signed-in recruiter's pipeline. */
  listAccessGrants: async (): Promise<TalentAccessGrant[]> => {
    const { data } = await api.get<Envelope<TalentAccessGrant[]>>(
      `${API_PREFIXES.rewards}/access-grants`,
    );
    return data.data;
  },
};

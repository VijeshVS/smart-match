import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  chargeTalentLensQuery,
  getWalletSummary,
  getRewardCatalog,
  getRewardRedemptions,
  listRecruiterAccessGrants,
  redeemReward,
  refundTalentLensQuery,
  unlockTier3,
} from '../services/rewards.service.js';
import {
  accessGrantQuerySchema,
  talentLensQuerySchema,
  rewardCatalogQuerySchema,
  redeemRewardSchema,
  unlockTier3Schema,
  walletQuerySchema,
} from '../validation/rewards.schemas.js';

export const rewardsRouter: Router = Router();

// Every rewards route requires a verified identity, either injected by the API
// Gateway or presented as a bearer token.
rewardsRouter.use(requireAuth);

rewardsRouter.get(
  '/catalog',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const query = rewardCatalogQuerySchema.parse(req.query);
    const catalog = await getRewardCatalog(query);
    res.status(200).json({ data: catalog });
  }),
);

rewardsRouter.post(
  '/redeem',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = redeemRewardSchema.parse(req.body);
    const result = await redeemReward(input, req.auth!);
    res.status(200).json({ data: result });
  }),
);

rewardsRouter.get(
  '/redemptions',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const redemptions = await getRewardRedemptions(req.auth!);
    res.status(200).json({ data: redemptions });
  }),
);

rewardsRouter.get(
  '/wallet',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const query = walletQuerySchema.parse(req.query);
    const summary = await getWalletSummary(query.recruiterId, req.auth!);
    res.status(200).json({ data: summary });
  }),
);

rewardsRouter.get(
  '/access-grants',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const query = accessGrantQuerySchema.parse(req.query);
    const grants = await listRecruiterAccessGrants(query.recruiterId, req.auth!);
    res.status(200).json({ data: grants });
  }),
);

rewardsRouter.post(
  '/unlock-tier3',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = unlockTier3Schema.parse(req.body);
    const result = await unlockTier3(input, req.auth!);
    res.status(200).json({ data: result });
  }),
);

// Internal charge/refund endpoints used by ai-matching-service before and after
// a TalentLens search. They are self-scoped: a recruiter can only spend their
// own wallet, and the identity is forwarded from the gateway/service caller.
rewardsRouter.post(
  '/talent-lens/charge',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = talentLensQuerySchema.parse(req.body);
    const result = await chargeTalentLensQuery(input, req.auth!);
    res.status(200).json({ data: result });
  }),
);

rewardsRouter.post(
  '/talent-lens/refund',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = talentLensQuerySchema.parse(req.body);
    const result = await refundTalentLensQuery(input, req.auth!);
    res.status(200).json({ data: result });
  }),
);

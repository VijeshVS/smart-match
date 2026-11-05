import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { getWalletSummary, unlockTier3 } from '../services/rewards.service.js';
import { unlockTier3Schema, walletQuerySchema } from '../validation/rewards.schemas.js';

export const rewardsRouter: Router = Router();

// Every rewards route requires a verified identity, either injected by the API
// Gateway or presented as a bearer token.
rewardsRouter.use(requireAuth);

rewardsRouter.get(
  '/wallet',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const query = walletQuerySchema.parse(req.query);
    const summary = await getWalletSummary(query.recruiterId, req.auth!);
    res.status(200).json({ data: summary });
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

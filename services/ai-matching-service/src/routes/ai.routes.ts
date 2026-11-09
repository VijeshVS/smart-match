import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { suggestImprovements } from '../services/suggestions.service.js';
import { summarizeProfile } from '../services/summary.service.js';
import { talentLens } from '../services/talent-lens.service.js';
import {
  profileSuggestionsRequestSchema,
  profileSummaryRequestSchema,
  talentLensRequestSchema,
} from '../validation/ai.schemas.js';

export const aiRouter: Router = Router();

// Every AI route requires a verified identity, either injected by the API
// Gateway or presented as a bearer token.
aiRouter.use(requireAuth);

aiRouter.post(
  '/summarize-profile',
  requireRoles('CANDIDATE', 'RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = profileSummaryRequestSchema.parse(req.body);
    const result = await summarizeProfile(input);
    res.status(200).json({ data: result });
  }),
);

aiRouter.post(
  '/suggest-improvements',
  requireRoles('CANDIDATE', 'RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = profileSuggestionsRequestSchema.parse(req.body);
    const result = await suggestImprovements(input);
    res.status(200).json({ data: result });
  }),
);

aiRouter.post(
  '/talent-lens',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = talentLensRequestSchema.parse(req.body);
    const result = await talentLens(input, req.auth!, req.header('authorization'));
    res.status(200).json({ data: result });
  }),
);

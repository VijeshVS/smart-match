import { Router } from 'express';
import { AppError, asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  createTalentProfile,
  getMyTalentProfile,
  getTalentProfile,
  listBlindTalentProfiles,
  listTalentProfiles,
  updateTalentLevel,
  updateTalentProfile,
} from '../services/talent.service.js';
import {
  blindTalentQuerySchema,
  createTalentProfileSchema,
  talentQuerySchema,
  updateTalentLevelSchema,
  updateTalentProfileSchema,
} from '../validation/talent.schemas.js';

export const talentRouter: Router = Router();

/** Express 5 types route params as `string | string[] | undefined`. */
function talentIdFrom(req: { params: Record<string, string | string[] | undefined> }): string {
  const value = req.params.id;
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) {
    throw new AppError(400, 'INVALID_IDENTIFIER', 'The talent profile id is required');
  }
  return id;
}

// Every talent route requires a verified identity, either injected by the
// API Gateway or presented as a bearer token.
talentRouter.use(requireAuth);

talentRouter.post(
  '/',
  requireRoles('CANDIDATE', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = createTalentProfileSchema.parse(req.body);
    const profile = await createTalentProfile(input, req.auth!);
    res.status(201).json({ data: profile });
  }),
);

talentRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const profile = await getMyTalentProfile(req.auth!);
    res.status(200).json({ data: profile });
  }),
);

/**
 * Blind review queue for Talent Swipe. Registered before `/:id` so the literal
 * path is never treated as a talent identifier.
 */
talentRouter.get(
  '/blind',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const query = blindTalentQuerySchema.parse(req.query);
    const result = await listBlindTalentProfiles(query);
    res.status(200).json(result);
  }),
);

talentRouter.get(
  '/',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const query = talentQuerySchema.parse(req.query);
    const result = await listTalentProfiles(query);
    res.status(200).json(result);
  }),
);

talentRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const profile = await getTalentProfile(talentIdFrom(req), req.auth!);
    res.status(200).json({ data: profile });
  }),
);

talentRouter.put(
  '/:id',
  requireRoles('CANDIDATE', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = updateTalentProfileSchema.parse(req.body);
    const profile = await updateTalentProfile(talentIdFrom(req), input, req.auth!);
    res.status(200).json({ data: profile });
  }),
);

talentRouter.patch(
  '/:id/level',
  requireRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const { level } = updateTalentLevelSchema.parse(req.body);
    const profile = await updateTalentLevel(talentIdFrom(req), level, req.auth!);
    res.status(200).json({ data: profile });
  }),
);

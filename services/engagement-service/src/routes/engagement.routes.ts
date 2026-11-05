import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  getRecruiterEngagementHistory,
  getTalentEngagementSummary,
  recordSwipe,
  submitReview,
} from '../services/engagement.service.js';
import {
  createReviewSchema,
  createSwipeSchema,
  recruiterIdParamSchema,
  talentIdParamSchema,
} from '../validation/engagement.schemas.js';

export const engagementRouter: Router = Router();

/** Express 5 types route params as `string | string[] | undefined`. */
function param(
  req: { params: Record<string, string | string[] | undefined> },
  name: string,
): string {
  const value = req.params[name];
  const id = Array.isArray(value) ? value[0] : value;
  return id ?? '';
}

// Every engagement route requires a verified identity, either injected by the
// API Gateway or presented as a bearer token.
engagementRouter.use(requireAuth);

engagementRouter.post(
  '/swipes',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = createSwipeSchema.parse(req.body);
    const result = await recordSwipe(input, req.auth!);
    res.status(result.created ? 201 : 200).json({
      data: result.swipe,
      meta: { decisionChanged: result.decisionChanged },
    });
  }),
);

engagementRouter.post(
  '/reviews',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = createReviewSchema.parse(req.body);
    const review = await submitReview(input, req.auth!);
    res.status(201).json({ data: review });
  }),
);

engagementRouter.get(
  '/talent/:talentId/summary',
  asyncHandler(async (req, res) => {
    const { talentId } = talentIdParamSchema.parse({ talentId: param(req, 'talentId') });
    const summary = await getTalentEngagementSummary(talentId);
    res.status(200).json({ data: summary });
  }),
);

engagementRouter.get(
  '/recruiter/:recruiterId/history',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { recruiterId } = recruiterIdParamSchema.parse({
      recruiterId: param(req, 'recruiterId'),
    });
    const history = await getRecruiterEngagementHistory(recruiterId, req.auth!);
    res.status(200).json({ data: history });
  }),
);

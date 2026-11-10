import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  getRecruiterEngagementHistory,
  getRecruiterQueueExclusions,
  getTalentEngagementSummary,
  listRecruiterInterests,
  markRecruiterInterest,
  recordSwipe,
  removeRecruiterInterest,
  submitReview,
} from '../services/engagement.service.js';
import {
  createRecruiterInterestSchema,
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
    const result = await submitReview(input, req.auth!);
    res.status(result.created ? 201 : 200).json({
      data: result.review,
      meta: { created: result.created, updated: result.updated },
    });
  }),
);

engagementRouter.get(
  '/interests',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const interests = await listRecruiterInterests(req.auth!.userId, req.auth!);
    res.status(200).json({ data: interests });
  }),
);

engagementRouter.post(
  '/interests',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = createRecruiterInterestSchema.parse(req.body);
    const result = await markRecruiterInterest(input, req.auth!);
    res.status(result.created ? 201 : 200).json({
      data: result.interest,
      meta: { created: result.created },
    });
  }),
);

engagementRouter.delete(
  '/interests/:talentId',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { talentId } = talentIdParamSchema.parse({ talentId: param(req, 'talentId') });
    const result = await removeRecruiterInterest(talentId, req.auth!);
    res.status(200).json({ data: result });
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

/**
 * Candidate ids already screened by the recruiter. The talent service uses
 * this to filter the blind Talent Swipe queue.
 */
engagementRouter.get(
  '/recruiter/:recruiterId/exclusions',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { recruiterId } = recruiterIdParamSchema.parse({
      recruiterId: param(req, 'recruiterId'),
    });
    const exclusions = await getRecruiterQueueExclusions(recruiterId, req.auth!);
    res.status(200).json({ data: exclusions });
  }),
);

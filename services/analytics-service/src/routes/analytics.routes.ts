import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  getCandidateAnalytics,
  getFunnelSummary,
  getRecruiterDashboard,
  getRecruiterLeaderboard,
  getTopSkills,
} from '../services/analytics.service.js';
import {
  candidateParamsSchema,
  funnelQuerySchema,
  leaderboardQuerySchema,
  recruiterDashboardQuerySchema,
  topSkillsQuerySchema,
} from '../validation/analytics.schemas.js';

export const analyticsRouter: Router = Router();

// Every analytics route requires a verified identity, either injected by the
// API Gateway or presented as a bearer token.
analyticsRouter.use(requireAuth);

analyticsRouter.get(
  '/candidate/:id',
  asyncHandler(async (req, res) => {
    const { id } = candidateParamsSchema.parse(req.params);
    const analytics = await getCandidateAnalytics(id, req.auth!);
    res.status(200).json({ data: analytics });
  }),
);

analyticsRouter.get(
  '/recruiter/dashboard',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const query = recruiterDashboardQuerySchema.parse(req.query);
    const dashboard = await getRecruiterDashboard(query.recruiterId, req.auth!);
    res.status(200).json({ data: dashboard });
  }),
);

analyticsRouter.get(
  '/skills',
  asyncHandler(async (req, res) => {
    const { limit } = topSkillsQuerySchema.parse(req.query);
    const skills = await getTopSkills(limit);
    res.status(200).json({ data: skills });
  }),
);

analyticsRouter.get(
  '/leaderboard',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { limit } = leaderboardQuerySchema.parse(req.query);
    const leaderboard = await getRecruiterLeaderboard(limit);
    res.status(200).json({ data: leaderboard });
  }),
);

analyticsRouter.get(
  '/funnel',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { days } = funnelQuerySchema.parse(req.query);
    const funnel = await getFunnelSummary(days);
    res.status(200).json({ data: funnel });
  }),
);

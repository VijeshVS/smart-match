import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import {
  createJobPosting,
  getMyRecruiterProfile,
  listJobPostings,
  upsertRecruiterProfile,
} from '../services/recruiter.service.js';
import {
  createJobPostingSchema,
  jobQuerySchema,
  upsertRecruiterProfileSchema,
} from '../validation/recruiter.schemas.js';

export const recruiterRouter: Router = Router();

// Every recruiter route requires a verified identity, either injected by the
// API Gateway or presented as a bearer token.
recruiterRouter.use(requireAuth);

recruiterRouter.post(
  '/profile',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = upsertRecruiterProfileSchema.parse(req.body);
    const result = await upsertRecruiterProfile(input, req.auth!);
    res.status(result.created ? 201 : 200).json({ data: result.context });
  }),
);

recruiterRouter.get(
  '/me',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const context = await getMyRecruiterProfile(req.auth!);
    res.status(200).json({ data: context });
  }),
);

recruiterRouter.post(
  '/jobs',
  requireRoles('RECRUITER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const input = createJobPostingSchema.parse(req.body);
    const job = await createJobPosting(input, req.auth!);
    res.status(201).json({ data: job });
  }),
);

recruiterRouter.get(
  '/jobs',
  asyncHandler(async (req, res) => {
    const query = jobQuerySchema.parse(req.query);
    const result = await listJobPostings(query, req.auth!);
    res.status(200).json(result);
  }),
);

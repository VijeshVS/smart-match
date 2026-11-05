import { z } from 'zod';
import {
  EMPLOYMENT_TYPES,
  JOB_POSTING_STATUSES,
  type EmploymentType,
  type JobPostingStatus,
} from '@talent-ai/shared-types';

export const employmentTypeSchema = z.enum([...EMPLOYMENT_TYPES] as [
  EmploymentType,
  ...EmploymentType[],
]);
export const jobPostingStatusSchema = z.enum([...JOB_POSTING_STATUSES] as [
  JobPostingStatus,
  ...JobPostingStatus[],
]);
export const jobPostingStatusFilterSchema = z.enum([...JOB_POSTING_STATUSES, 'ALL'] as [
  JobPostingStatus | 'ALL',
  ...Array<JobPostingStatus | 'ALL'>,
]);

function optionalUrl() {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().url('Must be a valid URL').max(500).optional(),
  );
}

const profileFields = {
  fullName: z.string().trim().min(2, 'Full name is required').max(120),
  email: z.string().trim().email('A valid email is required').max(254),
  organizationName: z.string().trim().min(2, 'Organization name is required').max(200),
  title: z.string().trim().min(1).max(120).optional(),
  phone: z
    .string()
    .trim()
    .min(6, 'Phone is too short')
    .max(32)
    .regex(/^[+0-9][0-9\s().-]*$/, 'Phone contains unsupported characters')
    .optional(),
  website: optionalUrl(),
} as const;

export const upsertRecruiterProfileSchema = z.object(profileFields);

const jobFields = {
  title: z.string().trim().min(3, 'Title is required').max(200),
  description: z.string().trim().min(10, 'Description is required').max(20_000),
  location: z.string().trim().min(1).max(200).optional(),
  employmentType: employmentTypeSchema.default('FULL_TIME'),
  requiredSkills: z
    .array(z.string().trim().min(1).max(60))
    .min(1, 'At least one required skill is required')
    .max(50),
  minExperienceYears: z.coerce.number().int().min(0).max(60).optional(),
  maxExperienceYears: z.coerce.number().int().min(0).max(60).optional(),
  status: jobPostingStatusSchema.default('OPEN'),
} as const;

const experienceRange = {
  message: 'minExperienceYears must be less than or equal to maxExperienceYears',
};

export const createJobPostingSchema = z
  .object(jobFields)
  .refine(
    (value) =>
      value.minExperienceYears === undefined ||
      value.maxExperienceYears === undefined ||
      value.minExperienceYears <= value.maxExperienceYears,
    experienceRange,
  );

function toSkillArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const entries = Array.isArray(value) ? value : [value];
  const skills = entries
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  return skills.length > 0 ? skills : undefined;
}

export const jobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  employmentType: employmentTypeSchema.optional(),
  location: z.string().trim().min(1).max(200).optional(),
  organizationId: z.string().uuid('organizationId must be a UUID').optional(),
  skills: z.preprocess(toSkillArray, z.array(z.string().trim().min(1).max(60)).max(20).optional()),
  status: jobPostingStatusFilterSchema.optional(),
});

export type UpsertRecruiterProfileInput = z.infer<typeof upsertRecruiterProfileSchema>;
export type CreateJobPostingInput = z.infer<typeof createJobPostingSchema>;
export type JobQueryInput = z.infer<typeof jobQuerySchema>;

import { z } from 'zod';
import { TALENT_LEVELS, type TalentLevel } from '@talent-ai/shared-types';

export const talentLevelSchema = z.enum([...TALENT_LEVELS] as [TalentLevel, ...TalentLevel[]]);

function optionalUrl() {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().url('Must be a valid URL').max(500).optional(),
  );
}

function isoDateString() {
  return z
    .string()
    .trim()
    .max(40)
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid ISO date');
}

const educationSchema = z.object({
  college: z.string().trim().min(2).max(200),
  degree: z.string().trim().min(1).max(120),
  branchOfStudy: z.string().trim().min(1).max(160),
  yearOfGraduation: z.coerce.number().int().min(1950).max(2100),
  gpa: z.coerce.number().min(0).max(10).optional(),
});

const workExperienceSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(160),
  durationMonths: z.coerce.number().int().min(0).max(1_200),
  responsibilities: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  startDate: isoDateString().optional(),
  endDate: isoDateString().optional(),
});

const profileFields = {
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().email('A valid email is required').max(254),
  phone: z
    .string()
    .trim()
    .min(6, 'Phone is required')
    .max(32)
    .regex(/^[+0-9][0-9\s().-]*$/, 'Phone contains unsupported characters'),
  field: z.string().trim().min(2, 'Field is required').max(120),
  skills: z
    .array(z.string().trim().min(1).max(60))
    .min(1, 'At least one skill is required')
    .max(40),
  experienceYears: z.coerce.number().min(0).max(60),
  education: z.array(educationSchema).max(10).optional(),
  previousExperience: z.array(workExperienceSchema).max(20).optional(),
  level: talentLevelSchema.optional(),
  bio: z.string().trim().max(2_000).optional(),
  portfolioUrl: optionalUrl(),
  linkedinUrl: optionalUrl(),
  githubUrl: optionalUrl(),
  resumeUrl: optionalUrl(),
} as const;

export const createTalentProfileSchema = z.object({
  ...profileFields,
  // Only administrators may target a different identity.
  userId: z.string().uuid('userId must be a UUID').optional(),
});

export const updateTalentProfileSchema = z
  .object(profileFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one updatable field is required',
  });

export const updateTalentLevelSchema = z.object({
  level: talentLevelSchema,
});

function toSkillArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const entries = Array.isArray(value) ? value : [value];
  const skills = entries
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  return skills.length > 0 ? skills : undefined;
}

const talentQueryBaseSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  field: z.string().trim().min(1).max(120).optional(),
  skills: z.preprocess(toSkillArray, z.array(z.string().trim().min(1).max(60)).max(20).optional()),
  minExperienceYears: z.coerce.number().min(0).max(60).optional(),
  maxExperienceYears: z.coerce.number().min(0).max(60).optional(),
});

function hasValidExperienceRange(value: {
  minExperienceYears?: number;
  maxExperienceYears?: number;
}): boolean {
  return (
    value.minExperienceYears === undefined ||
    value.maxExperienceYears === undefined ||
    value.minExperienceYears <= value.maxExperienceYears
  );
}

export const talentQuerySchema = talentQueryBaseSchema
  .extend({ level: talentLevelSchema.optional() })
  .refine(hasValidExperienceRange, {
    message: 'minExperienceYears must be less than or equal to maxExperienceYears',
  });

/**
 * Blind review queries deliberately omit tier filtering so callers cannot probe
 * for Elite candidates while reviewing anonymously.
 */
export const blindTalentQuerySchema = talentQueryBaseSchema.refine(hasValidExperienceRange, {
  message: 'minExperienceYears must be less than or equal to maxExperienceYears',
});

export type CreateTalentProfileInput = z.infer<typeof createTalentProfileSchema>;
export type UpdateTalentProfileInput = z.infer<typeof updateTalentProfileSchema>;
export type TalentQueryInput = z.infer<typeof talentQuerySchema>;
export type BlindTalentQueryInput = z.infer<typeof blindTalentQuerySchema>;

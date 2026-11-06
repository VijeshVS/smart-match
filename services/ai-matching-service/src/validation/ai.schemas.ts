import { TALENT_LEVELS } from '@talent-ai/shared-types';
import { z } from 'zod';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);

export const educationSchema = z.object({
  id: z.string().optional(),
  college: trimmedString(200),
  degree: trimmedString(120),
  branchOfStudy: trimmedString(160),
  yearOfGraduation: z.number().int().min(1950).max(2100),
  gpa: z.number().min(0).max(10).optional(),
});

export const workExperienceSchema = z.object({
  id: z.string().optional(),
  company: trimmedString(200),
  role: trimmedString(160),
  durationMonths: z.number().int().min(0).max(1_200),
  responsibilities: z.array(z.string().max(500)).max(40).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const profileSnapshotSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  userId: z.string().min(1).max(100).optional(),
  name: trimmedString(120),
  field: trimmedString(120),
  skills: z.array(trimmedString(80)).min(1).max(40),
  experienceYears: z.number().min(0).max(60),
  level: z.enum(TALENT_LEVELS).optional(),
  education: z.array(educationSchema).max(20).optional(),
  previousExperience: z.array(workExperienceSchema).max(30).optional(),
  bio: z.string().max(2_000).optional(),
});

const profileTargetRefinement = {
  message: 'Provide either a talentId or an inline profile',
  path: ['talentId'],
};

export const profileSummaryRequestSchema = z
  .object({
    talentId: z.string().min(1).max(100).optional(),
    profile: profileSnapshotSchema.optional(),
  })
  .refine((value) => Boolean(value.talentId ?? value.profile), profileTargetRefinement);

export const profileSuggestionsRequestSchema = z
  .object({
    talentId: z.string().min(1).max(100).optional(),
    profile: profileSnapshotSchema.optional(),
    reviews: z.array(z.string().trim().min(1).max(2_000)).max(50).optional(),
  })
  .refine((value) => Boolean(value.talentId ?? value.profile), profileTargetRefinement);

export const talentLensFiltersSchema = z
  .object({
    skills: z.array(trimmedString(80)).max(20).optional(),
    level: z.enum(TALENT_LEVELS).optional(),
    minExperienceYears: z.number().int().min(0).max(60).optional(),
    maxExperienceYears: z.number().int().min(0).max(60).optional(),
    field: trimmedString(120).optional(),
  })
  .refine(
    (value) =>
      value.minExperienceYears === undefined ||
      value.maxExperienceYears === undefined ||
      value.minExperienceYears <= value.maxExperienceYears,
    { message: 'minExperienceYears must be less than or equal to maxExperienceYears' },
  );

export const talentLensRequestSchema = z.object({
  query: z.string().trim().min(3, 'query must be at least 3 characters').max(2_000),
  limit: z.number().int().min(1).max(50).default(10),
  filters: talentLensFiltersSchema.optional(),
});

/**
 * Runtime guard for `talent.profile.created` / `talent.profile.updated`.
 * The indexer only needs the fields it embeds.
 */
export const talentProfileEventSchema = z.object({
  talentId: z.string().min(1).max(100),
  userId: z.string().min(1).max(100),
  name: trimmedString(120),
  skills: z.array(z.string().max(80)).max(40).default([]),
  experienceYears: z.number().min(0).max(60),
  level: z.enum(TALENT_LEVELS),
  field: trimmedString(120),
  education: z.array(educationSchema).max(20).optional(),
  previousExperience: z.array(workExperienceSchema).max(30).optional(),
  bio: z.string().max(2_000).optional(),
  changedFields: z.array(z.string().max(80)).max(50).optional(),
});

export type ProfileSummaryInput = z.infer<typeof profileSummaryRequestSchema>;
export type ProfileSuggestionsInput = z.infer<typeof profileSuggestionsRequestSchema>;
export type TalentLensInput = z.infer<typeof talentLensRequestSchema>;
export type TalentProfileEventInput = z.infer<typeof talentProfileEventSchema>;

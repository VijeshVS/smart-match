import type { FilterQuery } from 'mongoose';
import type {
  BlindTalentProfile,
  BlindTalentQueryParams,
  TalentProfile,
  TalentQueryParams,
} from '@talent-ai/shared-types';
import type { TalentProfileRecord } from '../models/talent-profile.model.js';

export const LEVEL_THRESHOLDS = {
  mid: 3,
  lead: 8,
} as const;

/**
 * Derives the Verified Talent Tier from total professional experience when the
 * caller does not supply an explicit level. PATCH /level can override it.
 */
export function deriveTalentLevel(experienceYears: number): TalentProfileRecord['level'] {
  if (experienceYears >= LEVEL_THRESHOLDS.lead) return 'LEVEL_3_LEAD';
  if (experienceYears >= LEVEL_THRESHOLDS.mid) return 'LEVEL_2_MID';
  return 'LEVEL_1_ENTRY';
}

/**
 * Trims skill labels, collapses internal whitespace, removes blanks and
 * de-duplicates case-insensitively while preserving the first canonical casing.
 */
export function normalizeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of skills) {
    const skill = raw.trim().replace(/\s+/g, ' ');
    if (!skill) continue;

    const key = skill.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(skill);
  }

  return normalized;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function caseInsensitiveExact(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value)}$`, 'i');
}

/**
 * Builds the Mongo filter for the recruiter-facing candidate directory.
 * Text fields use escaped case-insensitive regexes so partial names work;
 * skills use `$all` so every requested skill must be present.
 */
export function buildTalentFilter(params: TalentQueryParams): FilterQuery<TalentProfileRecord> {
  const filter: FilterQuery<TalentProfileRecord> = {};

  if (params.field) {
    filter.field = caseInsensitiveExact(params.field);
  }

  if (params.level) {
    filter.level = params.level;
  }

  if (params.skills && params.skills.length > 0) {
    filter.skills = { $all: params.skills.map(caseInsensitiveExact) };
  }

  if (params.minExperienceYears !== undefined || params.maxExperienceYears !== undefined) {
    filter.experienceYears = {
      ...(params.minExperienceYears === undefined ? {} : { $gte: params.minExperienceYears }),
      ...(params.maxExperienceYears === undefined ? {} : { $lte: params.maxExperienceYears }),
    };
  }

  if (params.search) {
    const pattern = new RegExp(escapeRegex(params.search), 'i');
    filter.$or = [{ name: pattern }, { field: pattern }, { bio: pattern }, { skills: pattern }];
  }

  return filter;
}

/**
 * Blind review filter. Unlike the directory filter it never exposes tier
 * filtering and only searches professional fields, so recruiters cannot probe
 * for a candidate by name, bio or Elite status.
 */
export function buildBlindTalentFilter(
  params: BlindTalentQueryParams,
  excludedTalentIds: readonly string[] = [],
): FilterQuery<TalentProfileRecord> {
  const filter: FilterQuery<TalentProfileRecord> = {};

  if (excludedTalentIds.length > 0) {
    filter._id = { $nin: [...excludedTalentIds] };
  }

  if (params.field) {
    filter.field = caseInsensitiveExact(params.field);
  }

  if (params.skills && params.skills.length > 0) {
    filter.skills = { $all: params.skills.map(caseInsensitiveExact) };
  }

  if (params.minExperienceYears !== undefined || params.maxExperienceYears !== undefined) {
    filter.experienceYears = {
      ...(params.minExperienceYears === undefined ? {} : { $gte: params.minExperienceYears }),
      ...(params.maxExperienceYears === undefined ? {} : { $lte: params.maxExperienceYears }),
    };
  }

  if (params.search) {
    const pattern = new RegExp(escapeRegex(params.search), 'i');
    filter.$or = [{ field: pattern }, { skills: pattern }];
  }

  return filter;
}

/** Stable, non-identifying label for a candidate in a blind review. */
export function blindCandidateRef(talentId: string): string {
  const suffix = talentId.replaceAll('-', '').slice(0, 6).toUpperCase();
  return `Candidate #${suffix}`;
}

/**
 * Strips every identity-bearing field from a talent profile. Only professional
 * qualifications and work samples remain, and the platform tier is omitted so
 * Elite status cannot influence the decision.
 */
export function toBlindTalentProfile(profile: TalentProfile): BlindTalentProfile {
  return {
    id: profile.id,
    candidateRef: blindCandidateRef(profile.id),
    field: profile.field,
    skills: [...profile.skills],
    experienceYears: profile.experienceYears,
    education: profile.education.map((entry) => ({ ...entry })),
    previousExperience: profile.previousExperience.map((entry) => ({
      ...entry,
      responsibilities: [...entry.responsibilities],
    })),
    ...(profile.portfolioUrl === undefined ? {} : { portfolioUrl: profile.portfolioUrl }),
    ...(profile.githubUrl === undefined ? {} : { githubUrl: profile.githubUrl }),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export function buildPaginationMeta(input: { page: number; limit: number; total: number }): {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
} {
  const totalPages = input.total === 0 ? 0 : Math.ceil(input.total / input.limit);

  return {
    page: input.page,
    limit: input.limit,
    total: input.total,
    totalPages,
    hasNextPage: input.page < totalPages,
    hasPreviousPage: input.page > 1,
  };
}

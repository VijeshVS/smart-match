import {
  PERMISSIONS,
  type EmploymentType,
  type JobPosting,
  type JobPostingStatus,
  type Organization,
  type Permission,
  type RecruiterProfile,
  type UserRole,
} from '@talent-ai/shared-types';
import type { Prisma } from '../generated/prisma/client.js';
import type { JobPosting as JobPostingRow } from '../generated/prisma/client.js';
import type { Organization as OrganizationRow } from '../generated/prisma/client.js';
import type { RecruiterProfile as RecruiterProfileRow } from '../generated/prisma/client.js';

/**
 * Recruiters always receive the recruiter grants, regardless of whether the
 * identity came through the gateway (which does not forward permissions) or a
 * directly verified bearer token.
 */
const RECRUITER_GRANTS: readonly Permission[] = [
  'talent:read',
  'talent:unlock',
  'recruiter:read',
  'recruiter:write',
  'engagement:swipe',
  'engagement:review',
  'rewards:read',
  'rewards:spend',
  'analytics:read',
];

export function recruiterPermissionsForRole(role: UserRole): Permission[] {
  if (role === 'ADMIN') return [...PERMISSIONS];
  if (role === 'RECRUITER') return [...RECRUITER_GRANTS];
  return [];
}

export function normalizeOrganizationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Derives the organization's canonical domain from its website so teammates
 * entering the same company website share one organization record.
 */
export function normalizeOrganizationDomain(website?: string): string | undefined {
  const candidate = website?.trim();
  if (!candidate) return undefined;

  try {
    const url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return undefined;
  }
}

/**
 * Trims skill labels, collapses whitespace, removes blanks and de-duplicates
 * case-insensitively while preserving the first canonical casing.
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

export interface JobFilterInput {
  status?: JobPostingStatus | 'ALL';
  employmentType?: EmploymentType;
  location?: string;
  organizationId?: string;
  skills?: string[];
  search?: string;
}

/**
 * Builds the Prisma filter for job listings. Candidates only ever see `OPEN`
 * jobs; recruiters and administrators can explicitly request other statuses.
 */
export function buildJobWhere(
  params: JobFilterInput,
  viewerRole: UserRole,
): Prisma.JobPostingWhereInput {
  const privileged = viewerRole === 'RECRUITER' || viewerRole === 'ADMIN';
  const where: Prisma.JobPostingWhereInput = {};

  if (params.status === 'ALL') {
    if (!privileged) where.status = 'OPEN';
  } else if (params.status) {
    where.status = privileged || params.status === 'OPEN' ? params.status : 'OPEN';
  } else {
    where.status = 'OPEN';
  }

  if (params.employmentType) {
    where.employmentType = params.employmentType;
  }

  if (params.organizationId) {
    where.organizationId = params.organizationId;
  }

  if (params.location) {
    where.location = { contains: params.location, mode: 'insensitive' };
  }

  const skills = normalizeSkills(params.skills ?? []);
  if (skills.length > 0) {
    where.requiredSkills = { hasSome: skills };
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
      { location: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  return where;
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

export function toOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    ...(row.domain ? { domain: row.domain } : {}),
    ...(row.website ? { website: row.website } : {}),
    ...(row.logoUrl ? { logoUrl: row.logoUrl } : {}),
    ...(row.industry ? { industry: row.industry } : {}),
    ...(row.size ? { size: row.size } : {}),
    ...(row.billingEmail ? { billingEmail: row.billingEmail } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toRecruiterProfile(row: RecruiterProfileRow): RecruiterProfile {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    fullName: row.fullName,
    email: row.email,
    ...(row.title ? { title: row.title } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    permissions: [...row.permissions],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toJobPosting(row: JobPostingRow): JobPosting {
  return {
    id: row.id,
    organizationId: row.organizationId,
    recruiterId: row.recruiterId,
    title: row.title,
    description: row.description,
    ...(row.location ? { location: row.location } : {}),
    employmentType: row.employmentType as EmploymentType,
    requiredSkills: [...row.requiredSkills],
    ...(row.minExperienceYears === null ? {} : { minExperienceYears: row.minExperienceYears }),
    ...(row.maxExperienceYears === null ? {} : { maxExperienceYears: row.maxExperienceYears }),
    status: row.status as JobPostingStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

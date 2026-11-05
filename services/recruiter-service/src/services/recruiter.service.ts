import { randomUUID } from 'node:crypto';
import { getCorrelationId } from '@talent-ai/logger';
import type {
  JobPosting,
  PaginatedResult,
  RecruiterJobPostedPayload,
  RecruiterProfileContext,
  RecruiterRegisteredPayload,
} from '@talent-ai/shared-types';
import {
  buildJobWhere,
  buildPaginationMeta,
  normalizeOrganizationDomain,
  normalizeOrganizationName,
  normalizeSkills,
  recruiterPermissionsForRole,
  toJobPosting,
  toOrganization,
  toRecruiterProfile,
} from '../domain/recruiter.js';
import type { RecruiterPrincipal } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { enqueueOutbox } from '../lib/outbox.js';
import { prisma } from '../lib/prisma.js';
import type {
  CreateJobPostingInput,
  JobQueryInput,
  UpsertRecruiterProfileInput,
} from '../validation/recruiter.schemas.js';

function correlationId(): string {
  return getCorrelationId() ?? randomUUID();
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

function toContext(
  profile: Parameters<typeof toRecruiterProfile>[0],
  organization: Parameters<typeof toOrganization>[0],
): RecruiterProfileContext {
  return {
    profile: toRecruiterProfile(profile),
    organization: toOrganization(organization),
  };
}

async function requireProfile(userId: string) {
  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    include: { organization: true },
  });

  if (!profile) {
    throw new AppError(
      404,
      'RECRUITER_PROFILE_NOT_FOUND',
      'Create a recruiter profile before using recruiter features',
    );
  }

  return profile;
}

export interface UpsertRecruiterProfileResult {
  context: RecruiterProfileContext;
  created: boolean;
}

/**
 * Creates or updates the authenticated recruiter's profile. A new profile and
 * its `recruiter.registered` outbox event commit in one transaction.
 */
export async function upsertRecruiterProfile(
  input: UpsertRecruiterProfileInput,
  principal: RecruiterPrincipal,
): Promise<UpsertRecruiterProfileResult> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const organizationName = normalizeOrganizationName(input.organizationName);
  const domain = normalizeOrganizationDomain(input.website);
  const permissions = recruiterPermissionsForRole(principal.role);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.recruiterProfile.findUnique({
        where: { userId: principal.userId },
        include: { organization: true },
      });

      if (existing) {
        const organization = await tx.organization.update({
          where: { id: existing.organizationId },
          data: {
            name: organizationName,
            ...(input.website === undefined
              ? {}
              : { website: input.website, domain: domain ?? null }),
          },
        });

        const profile = await tx.recruiterProfile.update({
          where: { id: existing.id },
          data: {
            fullName,
            email,
            permissions,
            ...(input.title === undefined ? {} : { title: input.title }),
            ...(input.phone === undefined ? {} : { phone: input.phone }),
          },
        });

        logger.info(
          { recruiterId: profile.id, organizationId: organization.id },
          'recruiter profile updated',
        );

        return { context: toContext(profile, organization), created: false };
      }

      let organization = domain ? await tx.organization.findUnique({ where: { domain } }) : null;

      organization ??= await tx.organization.findFirst({
        where: { name: { equals: organizationName, mode: 'insensitive' } },
      });

      organization ??= await tx.organization.create({
        data: {
          name: organizationName,
          ...(domain ? { domain } : {}),
          ...(input.website ? { website: input.website } : {}),
        },
      });

      const profile = await tx.recruiterProfile.create({
        data: {
          userId: principal.userId,
          organizationId: organization.id,
          fullName,
          email,
          permissions,
          ...(input.title ? { title: input.title } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
        },
      });

      const payload: RecruiterRegisteredPayload = {
        recruiterId: profile.id,
        userId: profile.userId,
        organizationId: organization.id,
        email: profile.email,
        organizationName: organization.name,
      };

      await enqueueOutbox(tx, {
        eventType: 'recruiter.registered',
        aggregateId: profile.id,
        correlationId: correlationId(),
        payload: { ...payload },
      });

      logger.info(
        { recruiterId: profile.id, organizationId: organization.id },
        'recruiter registered',
      );

      return { context: toContext(profile, organization), created: true };
    });
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      throw new AppError(
        409,
        'RECRUITER_PROFILE_CONFLICT',
        'This email address or organization domain is already in use',
      );
    }
    throw error;
  }
}

export async function getMyRecruiterProfile(
  principal: RecruiterPrincipal,
): Promise<RecruiterProfileContext> {
  const profile = await requireProfile(principal.userId);
  return toContext(profile, profile.organization);
}

/**
 * Creates a job posting inside the recruiter's organization. Only `OPEN`
 * postings emit `recruiter.job_posted`; drafts stay internal until published.
 */
export async function createJobPosting(
  input: CreateJobPostingInput,
  principal: RecruiterPrincipal,
): Promise<JobPosting> {
  const profile = await requireProfile(principal.userId);
  const requiredSkills = normalizeSkills(input.requiredSkills);

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.jobPosting.create({
      data: {
        organizationId: profile.organizationId,
        recruiterId: profile.id,
        title: input.title.trim(),
        description: input.description.trim(),
        ...(input.location ? { location: input.location } : {}),
        employmentType: input.employmentType,
        requiredSkills,
        ...(input.minExperienceYears === undefined
          ? {}
          : { minExperienceYears: input.minExperienceYears }),
        ...(input.maxExperienceYears === undefined
          ? {}
          : { maxExperienceYears: input.maxExperienceYears }),
        status: input.status,
      },
    });

    if (created.status === 'OPEN') {
      const payload: RecruiterJobPostedPayload = {
        jobId: created.id,
        recruiterId: profile.id,
        organizationId: profile.organizationId,
        title: created.title,
        requiredSkills: [...created.requiredSkills],
        employmentType: created.employmentType,
      };

      await enqueueOutbox(tx, {
        eventType: 'recruiter.job_posted',
        aggregateId: created.id,
        correlationId: correlationId(),
        payload: { ...payload },
      });
    }

    return created;
  });

  logger.info(
    { jobId: job.id, recruiterId: profile.id, status: job.status },
    'job posting created',
  );

  return toJobPosting(job);
}

export async function listJobPostings(
  query: JobQueryInput,
  principal: RecruiterPrincipal,
): Promise<PaginatedResult<JobPosting>> {
  const page = query.page;
  const limit = query.limit;
  const where = buildJobWhere(query, principal.role);

  const [jobs, total] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.jobPosting.count({ where }),
  ]);

  return {
    data: jobs.map(toJobPosting),
    meta: buildPaginationMeta({ page, limit, total }),
  };
}

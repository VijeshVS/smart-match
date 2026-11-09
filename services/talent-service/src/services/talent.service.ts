import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { getCorrelationId } from '@talent-ai/logger';
import type {
  BlindTalentProfile,
  PaginatedResult,
  TalentProfile,
  TalentProfileCreatedPayload,
  TalentProfileUpdatedPayload,
  TalentQueryParams,
} from '@talent-ai/shared-types';
import {
  buildBlindTalentFilter,
  buildPaginationMeta,
  buildTalentFilter,
  deriveTalentLevel,
  normalizeSkills,
  toBlindTalentProfile,
} from '../domain/talent.js';
import { fetchRecruiterQueueExclusions } from '../lib/engagement-client.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { enqueueOutbox } from '../lib/outbox.js';
import {
  TalentProfileModel,
  toEducationRecord,
  toTalentProfile,
  toWorkExperienceRecord,
  type TalentProfileDocument,
} from '../models/talent-profile.model.js';
import { isOwnerOrAdmin, type TalentPrincipal } from '../middleware/auth.js';
import type {
  BlindTalentQueryInput,
  CreateTalentProfileInput,
  UpdateTalentProfileInput,
} from '../validation/talent.schemas.js';

function correlationId(): string {
  return getCorrelationId() ?? randomUUID();
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isMongoObjectId(value: string): boolean {
  return mongoose.isValidObjectId(value) && String(new mongoose.Types.ObjectId(value)) === value;
}

function assertValidId(id: string): void {
  // UUID is the current contract. Legacy ObjectId profiles created before the
  // UUID migration remain readable until they are re-created.
  if (!UUID_PATTERN.test(id) && !isMongoObjectId(id)) {
    throw new AppError(400, 'INVALID_IDENTIFIER', 'The talent profile id is not valid');
  }
}

function resolveTargetUserId(input: CreateTalentProfileInput, principal: TalentPrincipal): string {
  if (principal.role === 'ADMIN') {
    return input.userId ?? principal.userId;
  }

  if (input.userId && input.userId !== principal.userId) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Candidates may only create a profile for their own identity',
    );
  }

  return principal.userId;
}

function profileEventPayload(doc: TalentProfileDocument): TalentProfileCreatedPayload {
  const profile = toTalentProfile(doc);

  return {
    talentId: profile.id,
    userId: profile.userId,
    name: profile.name,
    skills: profile.skills,
    experienceYears: profile.experienceYears,
    level: profile.level,
    field: profile.field,
    email: profile.email,
    education: profile.education,
    previousExperience: profile.previousExperience,
    ...(profile.bio === undefined ? {} : { bio: profile.bio }),
  };
}

function buildCreateDocument(
  input: CreateTalentProfileInput,
  userId: string,
): Record<string, unknown> {
  return {
    userId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    field: input.field.trim(),
    skills: normalizeSkills(input.skills),
    experienceYears: input.experienceYears,
    education: (input.education ?? []).map(toEducationRecord),
    previousExperience: (input.previousExperience ?? []).map(toWorkExperienceRecord),
    level: input.level ?? deriveTalentLevel(input.experienceYears),
    ...(input.bio === undefined ? {} : { bio: input.bio }),
    ...(input.portfolioUrl === undefined ? {} : { portfolioUrl: input.portfolioUrl }),
    ...(input.linkedinUrl === undefined ? {} : { linkedinUrl: input.linkedinUrl }),
    ...(input.githubUrl === undefined ? {} : { githubUrl: input.githubUrl }),
    ...(input.resumeUrl === undefined ? {} : { resumeUrl: input.resumeUrl }),
  };
}

/**
 * Creates a candidate profile and enqueues `talent.profile.created` in the same
 * MongoDB transaction, so downstream indexers never see a phantom profile.
 */
export async function createTalentProfile(
  input: CreateTalentProfileInput,
  principal: TalentPrincipal,
): Promise<TalentProfile> {
  const userId = resolveTargetUserId(input, principal);
  const email = input.email.trim().toLowerCase();

  const existing = await TalentProfileModel.findOne({
    $or: [{ userId }, { email }],
  })
    .select('userId email')
    .lean();

  if (existing) {
    throw new AppError(
      409,
      'PROFILE_ALREADY_EXISTS',
      existing.userId === userId
        ? 'A talent profile already exists for this identity'
        : 'A talent profile already exists for this email address',
    );
  }

  const session = await mongoose.startSession();
  let created: TalentProfileDocument | undefined;

  try {
    await session.withTransaction(async () => {
      const documents = await TalentProfileModel.create([buildCreateDocument(input, userId)], {
        session,
      });
      const document = documents[0];
      if (!document) {
        throw new AppError(500, 'PROFILE_CREATE_FAILED', 'Talent profile could not be created');
      }

      await enqueueOutbox(session, {
        eventType: 'talent.profile.created',
        aggregateId: document._id.toString(),
        correlationId: correlationId(),
        payload: { ...profileEventPayload(document) },
      });

      created = document;
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        'PROFILE_ALREADY_EXISTS',
        'A talent profile already exists for this identity or email address',
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!created) {
    throw new AppError(500, 'PROFILE_CREATE_FAILED', 'Talent profile could not be created');
  }

  logger.info(
    { talentId: created._id.toString(), userId, talentLevel: created.level },
    'talent profile created',
  );

  return toTalentProfile(created);
}

function buildProfileUpdate(input: UpdateTalentProfileInput): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (input.name !== undefined) update.name = input.name.trim();
  if (input.email !== undefined) update.email = input.email.trim().toLowerCase();
  if (input.phone !== undefined) update.phone = input.phone.trim();
  if (input.field !== undefined) update.field = input.field.trim();
  if (input.skills !== undefined) update.skills = normalizeSkills(input.skills);
  if (input.experienceYears !== undefined) update.experienceYears = input.experienceYears;
  if (input.education !== undefined) {
    update.education = input.education.map(toEducationRecord);
  }
  if (input.previousExperience !== undefined) {
    update.previousExperience = input.previousExperience.map(toWorkExperienceRecord);
  }
  if (input.level !== undefined) update.level = input.level;
  if (input.bio !== undefined) update.bio = input.bio;
  if (input.portfolioUrl !== undefined) update.portfolioUrl = input.portfolioUrl;
  if (input.linkedinUrl !== undefined) update.linkedinUrl = input.linkedinUrl;
  if (input.githubUrl !== undefined) update.githubUrl = input.githubUrl;
  if (input.resumeUrl !== undefined) update.resumeUrl = input.resumeUrl;

  return update;
}

/**
 * Updates a profile owned by the caller (or by anyone when the caller is an
 * administrator) and publishes `talent.profile.updated` with the changed field
 * names so the AI indexer can decide whether to re-embed.
 */
export async function updateTalentProfile(
  talentId: string,
  input: UpdateTalentProfileInput,
  principal: TalentPrincipal,
): Promise<TalentProfile> {
  assertValidId(talentId);

  const session = await mongoose.startSession();
  let updated: TalentProfileDocument | undefined;

  try {
    await session.withTransaction(async () => {
      const document = await TalentProfileModel.findById(talentId).session(session);
      if (!document) {
        throw new AppError(404, 'PROFILE_NOT_FOUND', 'Talent profile was not found');
      }

      if (!isOwnerOrAdmin(principal, document.userId)) {
        throw new AppError(403, 'FORBIDDEN', 'You may only update your own talent profile');
      }

      const update = buildProfileUpdate(input);
      const current = document.toObject() as unknown as Record<string, unknown>;
      const changedFields = Object.keys(update).filter(
        (key) => !isDeepStrictEqual(current[key], update[key]),
      );

      if (changedFields.length === 0) {
        updated = document;
        return;
      }

      document.set(update);
      await document.save({ session });

      const payload: TalentProfileUpdatedPayload = {
        ...profileEventPayload(document),
        changedFields,
      };

      await enqueueOutbox(session, {
        eventType: 'talent.profile.updated',
        aggregateId: document._id.toString(),
        correlationId: correlationId(),
        payload: { ...payload },
      });

      updated = document;

      logger.info({ talentId: document._id.toString(), changedFields }, 'talent profile updated');
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        'PROFILE_CONFLICT',
        'Another profile already uses this email address',
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!updated) {
    throw new AppError(500, 'PROFILE_UPDATE_FAILED', 'Talent profile could not be updated');
  }

  return toTalentProfile(updated);
}

export async function updateTalentLevel(
  talentId: string,
  level: TalentProfile['level'],
  principal: TalentPrincipal,
): Promise<TalentProfile> {
  return updateTalentProfile(talentId, { level }, principal);
}

export async function getTalentProfile(
  talentId: string,
  principal: TalentPrincipal,
): Promise<TalentProfile> {
  assertValidId(talentId);

  const document = await TalentProfileModel.findById(talentId);
  if (!document) {
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Talent profile was not found');
  }

  const canView = principal.role === 'RECRUITER' || isOwnerOrAdmin(principal, document.userId);
  if (!canView) {
    throw new AppError(403, 'FORBIDDEN', 'You may only view your own talent profile');
  }

  return toTalentProfile(document);
}

export async function getMyTalentProfile(principal: TalentPrincipal): Promise<TalentProfile> {
  const document = await TalentProfileModel.findOne({ userId: principal.userId });
  if (!document) {
    throw new AppError(
      404,
      'PROFILE_NOT_FOUND',
      'No talent profile exists for the authenticated identity',
    );
  }

  return toTalentProfile(document);
}

export async function listTalentProfiles(
  params: TalentQueryParams,
): Promise<PaginatedResult<TalentProfile>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;

  const filter = buildTalentFilter(params);

  const [documents, total] = await Promise.all([
    TalentProfileModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    TalentProfileModel.countDocuments(filter),
  ]);

  return {
    data: documents.map(toTalentProfile),
    meta: buildPaginationMeta({ page, limit, total }),
  };
}

/**
 * Recruiter-facing blind queue for Talent Swipe. Candidates the caller already
 * screened are removed before pagination, and profiles are mapped through
 * `toBlindTalentProfile`, so identity, contact details and tier never leave the
 * service.
 */
export async function listBlindTalentProfiles(
  params: BlindTalentQueryInput,
  principal: TalentPrincipal,
  authorization?: string,
): Promise<PaginatedResult<BlindTalentProfile>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;

  const excludedTalentIds = await fetchRecruiterQueueExclusions(principal, authorization);
  const filter = buildBlindTalentFilter(params, excludedTalentIds);

  const [documents, total] = await Promise.all([
    TalentProfileModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    TalentProfileModel.countDocuments(filter),
  ]);

  return {
    data: documents.map((document) => toBlindTalentProfile(toTalentProfile(document))),
    meta: buildPaginationMeta({ page, limit, total }),
  };
}

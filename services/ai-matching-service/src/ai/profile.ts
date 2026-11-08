import type {
  AiProfileSnapshot,
  TalentLevel,
  TalentProfileCreatedPayload,
  TalentProfileUpdatedPayload,
} from '@talent-ai/shared-types';
import type { AiProfile } from './types.js';

const INDEXED_FIELDS = new Set([
  'name',
  'field',
  'skills',
  'experienceYears',
  'level',
  'education',
  'previousExperience',
  'bio',
]);

/** Qdrant payloads are plain JSON; keep only fields the AI layer understands. */
export function profileFromEvent(
  payload: TalentProfileCreatedPayload | TalentProfileUpdatedPayload,
): AiProfile {
  return {
    talentId: payload.talentId,
    userId: payload.userId,
    name: payload.name,
    field: payload.field,
    skills: [...payload.skills],
    experienceYears: payload.experienceYears,
    level: payload.level,
    ...(payload.education === undefined ? {} : { education: payload.education }),
    ...(payload.previousExperience === undefined
      ? {}
      : { previousExperience: payload.previousExperience }),
    ...(payload.bio === undefined ? {} : { bio: payload.bio }),
  };
}

export function profileFromSnapshot(
  snapshot: AiProfileSnapshot,
  fallbackTalentId?: string,
): AiProfile {
  // Inline profiles are not persisted, so an id is optional. A stable sentinel
  // keeps cache keys deterministic when the caller did not supply one.
  const talentId = snapshot.id ?? fallbackTalentId ?? 'inline-profile';

  return {
    talentId,
    name: snapshot.name,
    field: snapshot.field,
    skills: [...snapshot.skills],
    experienceYears: snapshot.experienceYears,
    level: snapshot.level ?? 'LEVEL_1_ENTRY',
    ...(snapshot.userId === undefined ? {} : { userId: snapshot.userId }),
    ...(snapshot.education === undefined ? {} : { education: snapshot.education }),
    ...(snapshot.previousExperience === undefined
      ? {}
      : { previousExperience: snapshot.previousExperience }),
    ...(snapshot.bio === undefined ? {} : { bio: snapshot.bio }),
  };
}

export function levelOrDefault(level: string | undefined): TalentLevel {
  if (level === 'LEVEL_2_MID' || level === 'LEVEL_3_LEAD' || level === 'LEVEL_1_ENTRY') {
    return level;
  }
  return 'LEVEL_1_ENTRY';
}

export function profileNeedsReindex(changedFields: string[] | undefined): boolean {
  if (!changedFields || changedFields.length === 0) return true;
  return changedFields.some((field) => INDEXED_FIELDS.has(field));
}

/**
 * Text that is embedded into the dense vector. Skills are repeated so they
 * dominate the local hash embedding and the provider prompt payload.
 */
export function buildEmbeddingText(profile: AiProfile): string {
  const education = (profile.education ?? [])
    .map((entry) => `${entry.degree} in ${entry.branchOfStudy} from ${entry.college}`)
    .join('; ');
  const experience = (profile.previousExperience ?? [])
    .map((entry) => `${entry.role} at ${entry.company}: ${entry.responsibilities.join(', ')}`)
    .join('; ');

  return [
    `Candidate: ${profile.name}`,
    `Field: ${profile.field}`,
    `Level: ${profile.level}`,
    `Experience: ${profile.experienceYears} years`,
    `Skills: ${profile.skills.join(', ')}`,
    education ? `Education: ${education}` : '',
    experience ? `Experience history: ${experience}` : '',
    profile.bio ? `Bio: ${profile.bio}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

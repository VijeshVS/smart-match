import type { AiProfileSnapshot } from '@talent-ai/shared-types';
import { profileFromSnapshot } from '../ai/profile.js';
import type { AiProfile } from '../ai/types.js';
import { AppError } from '../lib/errors.js';
import { qdrant } from '../lib/qdrant.js';

export interface ProfileTarget {
  talentId?: string;
  profile?: AiProfileSnapshot;
}

/**
 * Resolves the profile an AI request is about. Callers may send the profile
 * inline (candidate portal) or rely on the snapshot indexed from
 * `talent.profile.*` events (recruiter portal).
 */
export async function resolveProfile(target: ProfileTarget): Promise<AiProfile> {
  if (target.profile) {
    return profileFromSnapshot(target.profile, target.talentId);
  }

  if (target.talentId) {
    const profile = await qdrant.getProfile(target.talentId);
    if (!profile) {
      throw new AppError(
        404,
        'PROFILE_NOT_INDEXED',
        'This talent profile has not been indexed yet. Retry shortly or send the profile inline.',
      );
    }
    return profile;
  }

  throw new AppError(400, 'PROFILE_REQUIRED', 'Provide either a talentId or an inline profile');
}

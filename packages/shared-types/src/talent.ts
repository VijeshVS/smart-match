import type { ISODateString, PaginationParams, UUID } from './common.js';

/**
 * Verified Talent Tiers.
 * LEVEL_1_ENTRY  -> Junior Fellow
 * LEVEL_2_MID    -> Pro Engineer
 * LEVEL_3_LEAD   -> Elite Principal
 */
export const TALENT_LEVELS = ['LEVEL_1_ENTRY', 'LEVEL_2_MID', 'LEVEL_3_LEAD'] as const;
export type TalentLevel = (typeof TALENT_LEVELS)[number];

export const TALENT_LEVEL_LABELS: Record<TalentLevel, string> = {
  LEVEL_1_ENTRY: 'Junior Fellow',
  LEVEL_2_MID: 'Pro Engineer',
  LEVEL_3_LEAD: 'Elite Principal',
};

export interface Education {
  id?: UUID;
  college: string;
  degree: string;
  branchOfStudy: string;
  yearOfGraduation: number;
  gpa?: number;
}

export interface WorkExperience {
  id?: UUID;
  company: string;
  role: string;
  durationMonths: number;
  responsibilities: string[];
  startDate?: ISODateString;
  endDate?: ISODateString;
}

export interface TalentProfile {
  id: UUID;
  /** Reference to the identity owned by auth-service. */
  userId: UUID;
  name: string;
  email: string;
  phone: string;
  field: string;
  skills: string[];
  experienceYears: number;
  education: Education[];
  previousExperience: WorkExperience[];
  level: TalentLevel;
  bio?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  resumeUrl?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CreateTalentProfileRequest {
  userId?: UUID;
  name: string;
  email: string;
  phone: string;
  field: string;
  skills: string[];
  experienceYears: number;
  education?: Education[];
  previousExperience?: WorkExperience[];
  level?: TalentLevel;
  bio?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  resumeUrl?: string;
}

export type UpdateTalentProfileRequest = Partial<Omit<CreateTalentProfileRequest, 'userId'>>;

export interface UpdateTalentLevelRequest {
  level: TalentLevel;
}

export interface TalentQueryParams extends PaginationParams {
  search?: string;
  field?: string;
  skills?: string[];
  level?: TalentLevel;
  minExperienceYears?: number;
  maxExperienceYears?: number;
}

export interface TalentProfileCreatedPayload {
  talentId: UUID;
  userId: UUID;
  name: string;
  skills: string[];
  experienceYears: number;
  level: TalentLevel;
  field: string;
  /** Optional contact address used by the notification service. */
  email?: string;
  /** Optional richer fields used by the AI indexer for embeddings. */
  education?: Education[];
  previousExperience?: WorkExperience[];
  bio?: string;
}

export interface TalentProfileUpdatedPayload extends TalentProfileCreatedPayload {
  changedFields: string[];
}

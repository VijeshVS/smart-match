import type { ISODateString, UUID } from './common.js';

export interface Organization {
  id: UUID;
  name: string;
  domain?: string;
  website?: string;
  logoUrl?: string;
  industry?: string;
  size?: string;
  billingEmail?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RecruiterProfile {
  id: UUID;
  userId: UUID;
  organizationId: UUID;
  fullName: string;
  email: string;
  title?: string;
  phone?: string;
  permissions: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Recruiter profile plus the organization context returned by `/recruiters/me`. */
export interface RecruiterProfileContext {
  profile: RecruiterProfile;
  organization: Organization;
}

export const JOB_POSTING_STATUSES = ['DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED'] as const;
export type JobPostingStatus = (typeof JOB_POSTING_STATUSES)[number];

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export interface JobPosting {
  id: UUID;
  organizationId: UUID;
  recruiterId: UUID;
  title: string;
  description: string;
  location?: string;
  employmentType: EmploymentType;
  requiredSkills: string[];
  minExperienceYears?: number;
  maxExperienceYears?: number;
  status: JobPostingStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface UpsertRecruiterProfileRequest {
  fullName: string;
  email: string;
  organizationName: string;
  title?: string;
  phone?: string;
  website?: string;
}

export interface CreateJobPostingRequest {
  title: string;
  description: string;
  location?: string;
  employmentType?: EmploymentType;
  requiredSkills: string[];
  minExperienceYears?: number;
  maxExperienceYears?: number;
  status?: JobPostingStatus;
}

export type UpdateJobPostingRequest = Partial<CreateJobPostingRequest>;

export interface RecruiterRegisteredPayload {
  recruiterId: UUID;
  userId: UUID;
  organizationId: UUID;
  email: string;
  organizationName: string;
}

export interface RecruiterJobPostedPayload {
  jobId: UUID;
  recruiterId: UUID;
  organizationId: UUID;
  title: string;
  requiredSkills: string[];
  employmentType: EmploymentType;
}

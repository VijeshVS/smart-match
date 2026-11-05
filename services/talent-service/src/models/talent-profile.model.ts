import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  TALENT_LEVELS,
  type Education,
  type TalentLevel,
  type TalentProfile,
  type WorkExperience,
} from '@talent-ai/shared-types';

export interface EducationRecord {
  college: string;
  degree: string;
  branchOfStudy: string;
  yearOfGraduation: number;
  gpa?: number;
}

export interface WorkExperienceRecord {
  company: string;
  role: string;
  durationMonths: number;
  responsibilities: string[];
  startDate?: Date;
  endDate?: Date;
}

export interface TalentProfileRecord {
  userId: string;
  name: string;
  email: string;
  phone: string;
  field: string;
  skills: string[];
  experienceYears: number;
  education: EducationRecord[];
  previousExperience: WorkExperienceRecord[];
  level: TalentLevel;
  bio?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  resumeUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TalentProfileDocument = HydratedDocument<TalentProfileRecord> & {
  _id: Types.ObjectId;
};

const educationSchema = new Schema<EducationRecord>(
  {
    college: { type: String, required: true, trim: true, maxlength: 200 },
    degree: { type: String, required: true, trim: true, maxlength: 120 },
    branchOfStudy: { type: String, required: true, trim: true, maxlength: 160 },
    yearOfGraduation: { type: Number, required: true, min: 1950, max: 2100 },
    // Most Indian institutions use a 10-point scale; 4-point scales fit too.
    gpa: { type: Number, min: 0, max: 10 },
  },
  { _id: false },
);

const workExperienceSchema = new Schema<WorkExperienceRecord>(
  {
    company: { type: String, required: true, trim: true, maxlength: 200 },
    role: { type: String, required: true, trim: true, maxlength: 160 },
    durationMonths: { type: Number, required: true, min: 0, max: 1_200 },
    responsibilities: { type: [String], default: [] },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { _id: false },
);

const talentProfileSchema = new Schema<TalentProfileRecord>(
  {
    userId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    field: { type: String, required: true, trim: true, maxlength: 120 },
    skills: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => value.length > 0 && value.length <= 40,
        message: 'A profile needs between 1 and 40 skills',
      },
    },
    experienceYears: { type: Number, required: true, min: 0, max: 60 },
    education: { type: [educationSchema], default: [] },
    previousExperience: { type: [workExperienceSchema], default: [] },
    level: {
      type: String,
      enum: [...TALENT_LEVELS],
      default: 'LEVEL_1_ENTRY',
      required: true,
    },
    bio: { type: String, trim: true, maxlength: 2_000 },
    portfolioUrl: { type: String, trim: true, maxlength: 500 },
    linkedinUrl: { type: String, trim: true, maxlength: 500 },
    githubUrl: { type: String, trim: true, maxlength: 500 },
    resumeUrl: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'talent_profiles',
  },
);

// One profile per identity; the email mirrors auth-service but is kept for
// recruiter-facing search and must remain unique inside this bounded context.
talentProfileSchema.index({ userId: 1 }, { unique: true });
talentProfileSchema.index({ email: 1 }, { unique: true });
talentProfileSchema.index({ level: 1, experienceYears: -1 });
talentProfileSchema.index({ field: 1 });
talentProfileSchema.index({ skills: 1 });

export const TalentProfileModel = model<TalentProfileRecord>('TalentProfile', talentProfileSchema);

export function toEducationRecord(input: Education): EducationRecord {
  return {
    college: input.college.trim(),
    degree: input.degree.trim(),
    branchOfStudy: input.branchOfStudy.trim(),
    yearOfGraduation: input.yearOfGraduation,
    ...(input.gpa === undefined ? {} : { gpa: input.gpa }),
  };
}

export function toWorkExperienceRecord(input: WorkExperience): WorkExperienceRecord {
  return {
    company: input.company.trim(),
    role: input.role.trim(),
    durationMonths: input.durationMonths,
    responsibilities: input.responsibilities.map((item) => item.trim()).filter(Boolean),
    ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
    ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
  };
}

/**
 * Maps the persistence record to the public `TalentProfile` DTO shared with
 * the portals and other services. Internal Mongo specifics never leak.
 */
export function toTalentProfile(doc: TalentProfileDocument): TalentProfile {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    field: doc.field,
    skills: [...doc.skills],
    experienceYears: doc.experienceYears,
    education: doc.education.map((entry) => ({
      college: entry.college,
      degree: entry.degree,
      branchOfStudy: entry.branchOfStudy,
      yearOfGraduation: entry.yearOfGraduation,
      ...(entry.gpa === undefined ? {} : { gpa: entry.gpa }),
    })),
    previousExperience: doc.previousExperience.map((entry) => ({
      company: entry.company,
      role: entry.role,
      durationMonths: entry.durationMonths,
      responsibilities: [...entry.responsibilities],
      ...(entry.startDate ? { startDate: entry.startDate.toISOString() } : {}),
      ...(entry.endDate ? { endDate: entry.endDate.toISOString() } : {}),
    })),
    level: doc.level,
    ...(doc.bio === undefined ? {} : { bio: doc.bio }),
    ...(doc.portfolioUrl === undefined ? {} : { portfolioUrl: doc.portfolioUrl }),
    ...(doc.linkedinUrl === undefined ? {} : { linkedinUrl: doc.linkedinUrl }),
    ...(doc.githubUrl === undefined ? {} : { githubUrl: doc.githubUrl }),
    ...(doc.resumeUrl === undefined ? {} : { resumeUrl: doc.resumeUrl }),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

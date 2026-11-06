import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Projection of candidate identities built from `talent.profile.*` events.
 * `review.submitted` and `rewards.tier3_unlocked` identify the candidate by
 * talent id, so the notification service needs the owning user and contact
 * address to address the alert.
 */
export interface TalentContactRecord {
  talentId: string;
  userId: string;
  name: string;
  email?: string;
  updatedAt: Date;
}

export type TalentContactDocument = HydratedDocument<TalentContactRecord> & {
  _id: Types.ObjectId;
};

const talentContactSchema = new Schema<TalentContactRecord>(
  {
    talentId: { type: String, required: true, unique: true, maxlength: 120 },
    userId: { type: String, required: true, index: true, maxlength: 120 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, maxlength: 254 },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: 'talent_contacts',
  },
);

export const TalentContactModel = model<TalentContactRecord>('TalentContact', talentContactSchema);

/**
 * Projection of recruiter identities built from `recruiter.registered`.
 * Engagement and reward events identify the recruiter by their user id, which
 * is why this projection is keyed on both `userId` and profile id.
 */
export interface RecruiterContactRecord {
  recruiterId: string;
  userId: string;
  organizationId: string;
  email: string;
  updatedAt: Date;
}

export type RecruiterContactDocument = HydratedDocument<RecruiterContactRecord> & {
  _id: Types.ObjectId;
};

const recruiterContactSchema = new Schema<RecruiterContactRecord>(
  {
    recruiterId: { type: String, required: true, index: true, maxlength: 120 },
    userId: { type: String, required: true, unique: true, maxlength: 120 },
    organizationId: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, maxlength: 254 },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: 'recruiter_contacts',
  },
);

export const RecruiterContactModel = model<RecruiterContactRecord>(
  'RecruiterContact',
  recruiterContactSchema,
);

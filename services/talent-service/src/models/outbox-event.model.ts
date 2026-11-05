import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import type { EventType } from '@talent-ai/shared-types';

export const OUTBOX_STATUSES = ['PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export interface OutboxEventRecord {
  eventType: EventType;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  status: OutboxStatus;
  attempts: number;
  availableAt: Date;
  publishedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OutboxEventDocument = HydratedDocument<OutboxEventRecord> & {
  _id: Types.ObjectId;
};

const outboxEventSchema = new Schema<OutboxEventRecord>(
  {
    eventType: { type: String, required: true, maxlength: 120 },
    aggregateId: { type: String, required: true, maxlength: 120 },
    payload: { type: Schema.Types.Mixed, required: true },
    correlationId: { type: String, maxlength: 120 },
    status: {
      type: String,
      enum: [...OUTBOX_STATUSES],
      default: 'PENDING',
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    availableAt: { type: Date, default: () => new Date(), required: true },
    publishedAt: { type: Date },
    lastError: { type: String, maxlength: 2_000 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'outbox_events',
  },
);

outboxEventSchema.index({ status: 1, availableAt: 1, createdAt: 1 });

export const OutboxEventModel = model<OutboxEventRecord>('OutboxEvent', outboxEventSchema);

import type { ISODateString, UUID } from './common.js';
import type { AuthUserRegisteredPayload } from './auth.js';
import type { TalentProfileCreatedPayload, TalentProfileUpdatedPayload } from './talent.js';
import type { RecruiterJobPostedPayload, RecruiterRegisteredPayload } from './recruiter.js';
import type { ReviewSubmittedPayload, SwipeRecordedPayload } from './engagement.js';
import type { CoinsAwardedPayload, Tier3UnlockedPayload } from './rewards.js';
import type { AiEvaluationCompletedPayload } from './ai.js';
import type { NotificationSentPayload } from './notification.js';

/** Canonical routing keys for the `talent.events.topic` exchange. */
export const EVENT_ROUTING_KEYS = [
  'auth.user_registered',
  'talent.profile.created',
  'talent.profile.updated',
  'recruiter.registered',
  'recruiter.job_posted',
  'swipe.recorded',
  'review.submitted',
  'rewards.coins_awarded',
  'rewards.tier3_unlocked',
  'ai.evaluation.completed',
  'notification.sent',
] as const;

export type EventType = (typeof EVENT_ROUTING_KEYS)[number];

/**
 * Compile-time contract between event types and their payloads.
 * Producers and consumers both derive their types from this map.
 */
export interface EventDataMap {
  'auth.user_registered': AuthUserRegisteredPayload;
  'talent.profile.created': TalentProfileCreatedPayload;
  'talent.profile.updated': TalentProfileUpdatedPayload;
  'recruiter.registered': RecruiterRegisteredPayload;
  'recruiter.job_posted': RecruiterJobPostedPayload;
  'swipe.recorded': SwipeRecordedPayload;
  'review.submitted': ReviewSubmittedPayload;
  'rewards.coins_awarded': CoinsAwardedPayload;
  'rewards.tier3_unlocked': Tier3UnlockedPayload;
  'ai.evaluation.completed': AiEvaluationCompletedPayload;
  'notification.sent': NotificationSentPayload;
}

export const EVENT_VERSION = '1.0';

/**
 * CloudEvents-inspired envelope used by every message on the event bus.
 */
export interface DomainEvent<T = unknown> {
  eventId: UUID;
  eventType: EventType;
  aggregateId: string;
  timestamp: ISODateString;
  /** W3C-style correlation id propagated from the API Gateway. */
  correlationId: string;
  version: string;
  data: T;
}

export type AnyDomainEvent = {
  [K in EventType]: DomainEvent<EventDataMap[K]>;
}[EventType];

export interface PublishOptions {
  correlationId?: string;
  /** Optional W3C traceparent header for distributed tracing. */
  traceparent?: string;
  version?: string;
}

export interface EventEnvelopeHeaders {
  eventId: string;
  eventType: EventType;
  aggregateId: string;
  correlationId: string;
  version: string;
  traceparent?: string;
}

/** Broker topology constants shared by producers and consumers. */
export const EVENT_TOPOLOGY = {
  exchange: 'talent.events.topic',
  exchangeType: 'topic',
  deadLetterExchange: 'talent.events.dlx',
  deadLetterQueue: 'talent.events.dlq',
  deadLetterRoutingKey: 'dead-letter',
} as const;

/** Queue naming convention: `<consumer-service>.<domain>`. */
export const EVENT_QUEUES = {
  aiTalentIndexer: 'ai-matching-service.talent-indexer',
  engagementTalentProfileConsumer: 'engagement-service.talent-profile-consumer',
  rewardsSwipeConsumer: 'rewards-service.swipe-consumer',
  rewardsReviewConsumer: 'rewards-service.review-consumer',
  notificationReviewConsumer: 'notification-service.review-consumer',
  notificationRewardsConsumer: 'notification-service.rewards-consumer',
  notificationTalentConsumer: 'notification-service.talent-consumer',
  notificationRegistrationConsumer: 'notification-service.registration-consumer',
  notificationMatchConsumer: 'notification-service.match-consumer',
  analyticsAllEvents: 'analytics-service.all-events',
} as const;

/**
 * Typed client for the talent.ai API Gateway.
 *
 * Every portal shares this package so authentication, refresh handling and
 * error normalisation behave identically.
 */
export { api, ApiClientError, toApiClientError, subscribeToAuth } from './http.js';
export { authStore, type AuthSnapshot } from './auth-store.js';
export { API_PREFIXES, gatewayBaseUrl, notificationSocketUrl, type ApiPrefix } from './env.js';

export {
  authApi,
  bootstrapSession,
  type AuthSession,
  type CurrentUserResponse,
} from './api/auth.js';
export { talentApi } from './api/talent.js';
export { recruiterApi } from './api/recruiters.js';
export { engagementApi, type SubmitReviewResult } from './api/engagement.js';
export { rewardsApi } from './api/rewards.js';
export { aiApi } from './api/ai.js';
export { analyticsApi } from './api/analytics.js';
export {
  notificationsApi,
  connectNotificationSocket,
  type NotificationListQuery,
  type NotificationSocketHandle,
  type RealtimeStatus,
} from './api/notifications.js';

export {
  NOTIFICATION_TYPES,
  SWIPE_DECISIONS,
  TALENT_CREDIT_RULES,
  TALENT_LEVELS,
  TALENT_LEVEL_LABELS,
} from '@talent-ai/shared-types';

export type {
  AuthTokens,
  AuthUser,
  BlindTalentProfile,
  BlindTalentQueryParams,
  CandidateAnalytics,
  CandidateReview,
  CreateReviewRequest,
  CreateSwipeRequest,
  CreateTalentProfileRequest,
  Education,
  FunnelAggregate,
  JobPosting,
  LedgerTransaction,
  RewardCatalogItem,
  RewardCategory,
  RewardRedemption,
  RedeemRewardRequest,
  RedeemRewardResponse,
  LoginRequest,
  Notification,
  NotificationListResponse,
  NotificationType,
  PaginatedResult,
  PaginationMeta,
  Permission,
  ProfileSuggestionsRequest,
  ProfileSuggestionsResult,
  ProfileSummaryRequest,
  ProfileSummaryResult,
  RecruiterDashboard,
  RecruiterEngagementHistory,
  RecruiterLeaderboardEntry,
  RecruiterQueueExclusions,
  RecruiterProfileContext,
  RecruiterTalentInterest,
  RegisterRequest,
  SkillAnalytics,
  SwipeDecision,
  SwipeInteraction,
  TalentAccessGrant,
  TalentEngagementSummary,
  TalentLensMatch,
  TalentLensRequest,
  TalentLensResponse,
  TalentLevel,
  TalentProfile,
  TalentQueryParams,
  UnlockTier3Request,
  UnlockTier3Response,
  UpdateTalentProfileRequest,
  UpsertRecruiterProfileRequest,
  Wallet,
  WalletSummary,
  WorkExperience,
} from '@talent-ai/shared-types';

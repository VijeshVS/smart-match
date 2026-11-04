import type { ServiceName } from './common.js';

/** Target ports from the architecture blueprint. */
export const SERVICE_PORTS: Record<ServiceName, number> = {
  'api-gateway': 8080,
  'auth-service': 5001,
  'talent-service': 5002,
  'recruiter-service': 5003,
  'engagement-service': 5004,
  'rewards-service': 5005,
  'ai-matching-service': 5006,
  'notification-service': 5007,
  'analytics-service': 5008,
};

/** Gateway path prefixes mapped to their owning service. */
export const API_PREFIXES = {
  auth: '/api/v1/auth',
  talent: '/api/v1/talent',
  recruiters: '/api/v1/recruiters',
  engagement: '/api/v1/engagement',
  rewards: '/api/v1/rewards',
  ai: '/api/v1/ai',
  notifications: '/api/v1/notifications',
  analytics: '/api/v1/analytics',
} as const;

export const INTERNAL_HEADERS = {
  correlationId: 'x-correlation-id',
  userId: 'x-user-id',
  userRole: 'x-user-role',
  userEmail: 'x-user-email',
  requestId: 'x-request-id',
} as const;

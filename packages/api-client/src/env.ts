type ViteEnv = Record<string, string | undefined>;

const env = (import.meta as ImportMeta & { env?: ViteEnv }).env ?? {};

/** Base URL of the API Gateway, e.g. `https://api.talent.ai`. */
export const gatewayBaseUrl = (
  env.VITE_API_GATEWAY_URL ??
  'http://localhost:8080'
).replace(/\/+$/, '');

/** WebSocket endpoint exposed by the notification service. */
export const notificationSocketUrl =
  env.VITE_NOTIFICATION_WS_URL ?? 'ws://localhost:5007/ws/notifications';

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

export type ApiPrefix = (typeof API_PREFIXES)[keyof typeof API_PREFIXES];

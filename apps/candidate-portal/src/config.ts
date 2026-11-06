/**
 * Runtime configuration sourced from Vite environment variables.
 * All service traffic flows through the centralized @talent-ai/api-client.
 */
export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME ?? 'talent.ai',
  siteUrl: import.meta.env.VITE_SITE_URL ?? 'https://talent.ai',
  recruiterPortalUrl: import.meta.env.VITE_RECRUITER_PORTAL_URL ?? 'https://recruiter.talent.ai',
  apiGatewayUrl: import.meta.env.VITE_API_GATEWAY_URL ?? 'http://localhost:8080',
  notificationWsUrl:
    import.meta.env.VITE_NOTIFICATION_WS_URL ?? 'ws://localhost:5007/ws/notifications',
} as const;

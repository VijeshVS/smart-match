/**
 * Runtime configuration sourced from Vite environment variables.
 *
 * HTTP and authenticated session traffic flow through the centralized
 * @talent-ai/api-client, which targets the API Gateway as the only backend
 * entry point. These values are provided for app-level config and env parity.
 */
const apiGatewayUrl = (
  import.meta.env.VITE_API_GATEWAY_URL ?? 'http://localhost:8080'
).replace(/\/+$/, '');

const gatewayOrigin = new URL(apiGatewayUrl);
gatewayOrigin.protocol = gatewayOrigin.protocol === 'https:' ? 'wss:' : 'ws:';

export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME ?? 'talent.ai',
  siteUrl: import.meta.env.VITE_SITE_URL ?? 'https://talent.ai',
  recruiterPortalUrl: import.meta.env.VITE_RECRUITER_PORTAL_URL ?? 'https://recruiter.talent.ai',
  apiGatewayUrl,
  notificationWsUrl:
    import.meta.env.VITE_NOTIFICATION_WS_URL ?? `${gatewayOrigin.origin}/ws/notifications`,
} as const;

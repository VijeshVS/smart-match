/**
 * Runtime configuration sourced from Vite environment variables.
 * Phase 8 will replace `legacyApiUrl` with the API Gateway client.
 */
export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME ?? 'talent.ai',
  siteUrl: import.meta.env.VITE_SITE_URL ?? 'https://talent.ai',
  apiGatewayUrl: import.meta.env.VITE_API_GATEWAY_URL ?? 'http://localhost:8080',
  legacyApiUrl: import.meta.env.VITE_LEGACY_API_URL ?? 'http://localhost:4000',
} as const;

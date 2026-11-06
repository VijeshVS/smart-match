import { createApiClient } from '@talent-ai/api-client';
import { appConfig } from '../config';

/**
 * Shared gateway client for the Recruiter Portal.
 *
 * `appConfig.apiGatewayUrl` resolves `VITE_API_GATEWAY_URL`; the client
 * attaches the JWT and refreshes it on 401. Login lives at `/` (Home).
 */
export const apiClient = createApiClient({
  baseURL: appConfig.apiGatewayUrl,
  loginPath: '/',
});

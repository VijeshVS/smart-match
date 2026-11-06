import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { AuthUser, Permission } from '@talent-ai/shared-types';
import { API_PREFIXES, gatewayBaseUrl } from './env.js';
import { authStore, type AuthSnapshot } from './auth-store.js';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface RefreshResponse {
  user: AuthUser;
  permissions: Permission[];
  tokens: { accessToken: string; tokenType: 'Bearer'; expiresIn: number };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId?: string;
  readonly details?: unknown;

  constructor(input: {
    message: string;
    status: number;
    code: string;
    correlationId?: string;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'ApiClientError';
    this.status = input.status;
    this.code = input.code;
    this.correlationId = input.correlationId;
    this.details = input.details;
  }
}

export function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;

  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { error?: { code?: string; message?: string; correlationId?: string; details?: unknown } }
      | undefined;

    return new ApiClientError({
      message:
        body?.error?.message ??
        (error.response
          ? `Request failed with status ${error.response.status}`
          : 'The talent.ai API is unreachable. Check your connection and try again.'),
      status: error.response?.status ?? 0,
      code: body?.error?.code ?? (error.response ? 'REQUEST_FAILED' : 'NETWORK_ERROR'),
      correlationId: body?.error?.correlationId,
      details: body?.error?.details,
    });
  }

  return new ApiClientError({
    message: error instanceof Error ? error.message : 'Unexpected error',
    status: 0,
    code: 'UNKNOWN_ERROR',
  });
}

let refreshInFlight: Promise<RefreshResponse | null> | null = null;

async function refreshAccessToken(): Promise<RefreshResponse | null> {
  try {
    const { data } = await axios.post<RefreshResponse>(
      `${gatewayBaseUrl}${API_PREFIXES.auth}/refresh`,
      {},
      { withCredentials: true, timeout: 15_000 },
    );

    authStore.setSession({
      user: data.user,
      permissions: data.permissions,
      accessToken: data.tokens.accessToken,
    });

    return data;
  } catch {
    authStore.setAnonymous();
    return null;
  }
}

function refreshOnce(): Promise<RefreshResponse | null> {
  refreshInFlight ??= refreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export const api: AxiosInstance = axios.create({
  baseURL: gatewayBaseUrl,
  withCredentials: true,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = authStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/register');
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retry && !isAuthCall && !isRefreshCall) {
      original._retry = true;
      const refreshed = await refreshOnce();

      if (refreshed) {
        original.headers.Authorization = `Bearer ${refreshed.tokens.accessToken}`;
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);

/** Subscribe to authentication state changes from the API client. */
export function subscribeToAuth(listener: (snapshot: AuthSnapshot) => void): () => void {
  return authStore.subscribe(() => listener(authStore.getSnapshot()));
}

import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_PREFIXES, type AuthTokens } from '@talent-ai/shared-types';
import { tokenStore, type TokenStore } from './tokenStore.js';

export const DEFAULT_API_TIMEOUT_MS = 15_000;
export const DEFAULT_LOGIN_PATH = '/login';

export interface SessionExpiredInfo {
  originalUrl?: string;
  error?: unknown;
}

export interface ApiClientOptions {
  /**
   * Gateway base URL. Defaults to `VITE_API_GATEWAY_URL` read from
   * `import.meta.env` (Vite) — no localhost URL is hard-coded here.
   * When neither is available the client uses relative URLs (`''`),
   * which works for same-origin / gateway-fronted deployments.
   */
  baseURL?: string;
  timeout?: number;
  /** Where to redirect when refresh fails. Both portals use `'/'`. */
  loginPath?: string;
  /** Override the default redirect (e.g. with router-aware navigation). */
  onSessionExpired?: (info: SessionExpiredInfo) => void;
  tokenStore?: TokenStore;
  /** Override for tests / alternate gateways. */
  refreshPath?: string;
}

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

interface RefreshResponse {
  tokens?: AuthTokens;
  accessToken?: string;
  refreshToken?: string;
}

const AUTH_PATH_SUFFIXES = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'] as const;

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Reads `VITE_API_GATEWAY_URL` from Vite's `import.meta.env` when
 * available. Returns an empty string (relative URLs) otherwise.
 * Safe in Node / test runtimes where `import.meta.env` does not exist.
 */
export function getApiGatewayBaseURL(): string {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const fromMeta = meta.env?.VITE_API_GATEWAY_URL;
    if (typeof fromMeta === 'string' && fromMeta.trim().length > 0) {
      return stripTrailingSlash(fromMeta.trim());
    }
  } catch {
    // Ignore — fall through to the process env / relative default.
  }

  try {
    const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
      .process?.env;
    const fromProcess = proc?.['VITE_API_GATEWAY_URL'];
    if (typeof fromProcess === 'string' && fromProcess.trim().length > 0) {
      return stripTrailingSlash(fromProcess.trim());
    }
  } catch {
    // Ignore — use the relative default below.
  }

  return '';
}

function isAuthRequest(url: string | undefined, refreshPath: string): boolean {
  if (!url) return false;
  if (url === refreshPath || url.endsWith(refreshPath)) return true;
  return AUTH_PATH_SUFFIXES.some((suffix) => url.endsWith(suffix));
}

function hasAuthorizationHeader(config: InternalAxiosRequestConfig): boolean {
  const headers = config.headers;
  if (!headers) return false;
  if (typeof headers.has === 'function') {
    try {
      return headers.has('Authorization');
    } catch {
      return false;
    }
  }
  const record = headers as unknown as Record<string, unknown>;
  return Object.keys(record).some((key) => key.toLowerCase() === 'authorization');
}

function setAuthorizationHeader(config: InternalAxiosRequestConfig, token: string): void {
  const headers = config.headers;
  if (!headers) return;
  if (typeof headers.set === 'function') {
    headers.set('Authorization', `Bearer ${token}`);
    return;
  }
  (headers as unknown as Record<string, string>)['Authorization'] = `Bearer ${token}`;
}

function redirectToLogin(loginPath: string): void {
  try {
    if (typeof window === 'undefined' || typeof window.location === 'undefined') return;
    if (window.location.pathname === loginPath) return;
    window.location.href = loginPath;
  } catch {
    // Redirect failures must not mask the original error.
  }
}

function toError(error: unknown): AxiosError {
  if (axios.isAxiosError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  const wrapped = new axios.AxiosError(message);
  if (error instanceof Error) wrapped.cause = error;
  return wrapped;
}

function resolveRefreshResponseData(data: unknown): { accessToken?: string; refreshToken?: string } {
  if (!data || typeof data !== 'object') return {};
  const body = data as RefreshResponse & { data?: RefreshResponse };
  // Support both gateway shapes: `{ tokens: {...} }` and `{ data: { tokens } }`.
  const tokens = body.tokens ?? body.data?.tokens;
  const accessToken = tokens?.accessToken ?? body.tokens?.accessToken ?? body.accessToken ?? body.data?.accessToken;
  const refreshToken =
    tokens?.refreshToken ?? body.tokens?.refreshToken ?? body.refreshToken ?? body.data?.refreshToken;
  return {
    ...(accessToken ? { accessToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
  };
}

/**
 * Creates a configured Axios instance with JWT attach and single-flight
 * refresh on 401. Each instance has its own refresh promise so concurrent
 * failures share one refresh request instead of racing.
 */
export function createApiClient(options: ApiClientOptions = {}): AxiosInstance {
  const store: TokenStore = options.tokenStore ?? tokenStore;
  const baseURL = stripTrailingSlash(options.baseURL ?? getApiGatewayBaseURL());
  const refreshPath = options.refreshPath ?? `${API_PREFIXES.auth}/refresh`;
  const loginPath = options.loginPath ?? DEFAULT_LOGIN_PATH;

  const instance = axios.create({
    baseURL,
    timeout: options.timeout ?? DEFAULT_API_TIMEOUT_MS,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // Single-flight refresh: all concurrent 401s await the same promise.
  let refreshPromise: Promise<string> | null = null;

  const doRefresh = async (): Promise<string> => {
    const storedRefresh = store.getRefreshToken();
    const payload = storedRefresh ? { refreshToken: storedRefresh } : {};
    // Bare axios (no interceptors) so a failed refresh never re-enters this handler.
    const response = await axios.post(`${baseURL}${refreshPath}`, payload, {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
      timeout: options.timeout ?? DEFAULT_API_TIMEOUT_MS,
    });

    const { accessToken, refreshToken } = resolveRefreshResponseData(response.data);
    if (!accessToken) {
      throw new Error('Refresh response did not contain an access token');
    }
    store.setAccessToken(accessToken);
    if (refreshToken) store.setRefreshToken(refreshToken);
    return accessToken;
  };

  const refreshAccessToken = (): Promise<string> => {
    if (refreshPromise) return refreshPromise;
    const pending = doRefresh();
    refreshPromise = pending.finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  };

  instance.interceptors.request.use((config) => {
    const token = store.getAccessToken();
    if (token && !hasAuthorizationHeader(config)) {
      setAuthorizationHeader(config, token);
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const axiosError: AxiosError = toError(error);
      const status = axiosError.response?.status ?? axiosError.status;
      const originalRequest = axiosError.config as RetryableRequestConfig | undefined;

      if (status !== 401 || !originalRequest) throw axiosError;
      if (originalRequest._retry) throw axiosError;
      // Never attempt refresh for auth endpoints themselves (login/register/refresh/logout).
      if (isAuthRequest(originalRequest.url, refreshPath)) throw axiosError;

      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        setAuthorizationHeader(originalRequest, newToken);
        return instance(originalRequest);
      } catch (refreshError) {
        store.clear();
        if (options.onSessionExpired) {
          try {
            options.onSessionExpired({ originalUrl: originalRequest.url, error: refreshError });
          } catch {
            // Ignore handler failures — the original 401 is still propagated.
          }
        } else {
          redirectToLogin(loginPath);
        }
        throw axiosError;
      }
    },
  );

  return instance;
}

/**
 * Default singleton client. It resolves its base URL from
 * `VITE_API_GATEWAY_URL` at import time. Apps that prefer explicit
 * configuration should use `createApiClient({ baseURL: appConfig.apiGatewayUrl })`.
 */
export const apiClient: AxiosInstance = createApiClient();

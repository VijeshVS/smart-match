import type {
  AuthTokens,
  AuthUser,
  LoginRequest,
  Permission,
  RegisterRequest,
} from '@talent-ai/shared-types';
import { api } from '../http.js';
import { authStore } from '../auth-store.js';
import { API_PREFIXES } from '../env.js';

/** Login/register/refresh response returned by the auth service. */
export interface AuthSession {
  user: AuthUser;
  permissions: Permission[];
  tokens: AuthTokens;
}

export interface CurrentUserResponse {
  user: AuthUser;
  permissions: Permission[];
}

function persist(response: AuthSession): AuthSession {
  authStore.setSession({
    user: response.user,
    permissions: response.permissions,
    accessToken: response.tokens.accessToken,
  });
  return response;
}

export const authApi = {
  register: async (input: RegisterRequest): Promise<AuthSession> => {
    const { data } = await api.post<AuthSession>(`${API_PREFIXES.auth}/register`, input);
    return persist(data);
  },

  login: async (input: LoginRequest): Promise<AuthSession> => {
    const { data } = await api.post<AuthSession>(`${API_PREFIXES.auth}/login`, input);
    return persist(data);
  },

  refresh: async (): Promise<AuthSession> => {
    const { data } = await api.post<AuthSession>(`${API_PREFIXES.auth}/refresh`, {});
    return persist(data);
  },

  logout: async (): Promise<void> => {
    try {
      await api.post(`${API_PREFIXES.auth}/logout`, {});
    } finally {
      authStore.setAnonymous();
    }
  },

  me: async (): Promise<CurrentUserResponse> => {
    const { data } = await api.get<CurrentUserResponse>(`${API_PREFIXES.auth}/me`);
    authStore.setUser(data.user, data.permissions);
    return data;
  },
};

/**
 * Restores a session on app boot. Uses the persisted access token when it is
 * still valid, otherwise falls back to the refresh-token cookie.
 */
export async function bootstrapSession(): Promise<void> {
  const token = authStore.getAccessToken();

  if (token) {
    try {
      await authApi.me();
      return;
    } catch {
      // Fall through to refresh.
    }
  }

  try {
    await authApi.refresh();
  } catch {
    authStore.setAnonymous();
  }
}

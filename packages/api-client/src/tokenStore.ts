/**
 * Token storage abstraction for the shared API client.
 *
 * The access token is persisted in `localStorage` when available so it
 * survives reloads. The refresh token is kept in memory only: the auth
 * service sets it as an `HttpOnly` cookie, so JavaScript does not need it
 * for `withCredentials` refresh calls. It is only mirrored from the JSON
 * body when the server returns one (e.g. for non-browser consumers).
 *
 * No secrets are hard-coded here. Apps may supply their own `TokenStore`
 * implementation via `createApiClient({ tokenStore })`.
 */

export const ACCESS_TOKEN_STORAGE_KEY = 'talent.ai.accessToken';

export interface TokenStore {
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
  getRefreshToken(): string | null;
  setRefreshToken(token: string | null): void;
  clear(): void;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return null;
    }
    // Access can throw in private / sandboxed contexts.
    const storage = window.localStorage;
    const probeKey = '__talent_ai_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

export function createMemoryTokenStore(): TokenStore {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  return {
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token;
    },
    getRefreshToken: () => refreshToken,
    setRefreshToken: (token) => {
      refreshToken = token;
    },
    clear: () => {
      accessToken = null;
      refreshToken = null;
    },
  };
}

/**
 * Default store: access token in `localStorage` (if available), refresh
 * token in memory. Safe to use during SSR / tests where `window` or
 * `localStorage` is unavailable — it degrades to memory-only.
 */
export function createTokenStore(): TokenStore {
  const storage = getStorage();
  let memoryAccess: string | null = storage?.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? null;
  let refreshToken: string | null = null;

  return {
    getAccessToken: () => {
      // Re-read from storage so external writes stay visible.
      if (storage) {
        try {
          memoryAccess = storage.getItem(ACCESS_TOKEN_STORAGE_KEY);
        } catch {
          // Fall through to the in-memory value.
        }
      }
      return memoryAccess;
    },
    setAccessToken: (token) => {
      memoryAccess = token;
      if (storage) {
        try {
          if (token) {
            storage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
          } else {
            storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
          }
        } catch {
          // Keep the in-memory value if persistence fails.
        }
      }
    },
    getRefreshToken: () => refreshToken,
    setRefreshToken: (token) => {
      refreshToken = token;
    },
    clear: () => {
      memoryAccess = null;
      refreshToken = null;
      if (storage) {
        try {
          storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        } catch {
          // Ignore storage failures during logout / expiry handling.
        }
      }
    },
  };
}

/** Shared default store instance used by the singleton `apiClient`. */
export const tokenStore: TokenStore = createTokenStore();

export function getAccessToken(): string | null {
  return tokenStore.getAccessToken();
}

export function setAccessToken(token: string | null): void {
  tokenStore.setAccessToken(token);
}

export function getRefreshToken(): string | null {
  return tokenStore.getRefreshToken();
}

export function setRefreshToken(token: string | null): void {
  tokenStore.setRefreshToken(token);
}

export function clearTokens(): void {
  tokenStore.clear();
}

import type { AuthUser, Permission } from '@talent-ai/shared-types';

const STORAGE_KEY = 'talent.ai.session';

export interface AuthSnapshot {
  user: AuthUser | null;
  permissions: Permission[];
  accessToken: string | null;
  status: 'loading' | 'authenticated' | 'anonymous';
}

interface StoredSession {
  user: AuthUser;
  permissions: Permission[];
  accessToken: string;
}

function readStorage(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.accessToken || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(session: StoredSession | null) {
  if (typeof window === 'undefined') return;
  try {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode / quota). The in-memory state
    // remains authoritative for the current tab.
  }
}

const initial = readStorage();

let snapshot: AuthSnapshot = {
  user: initial?.user ?? null,
  permissions: initial?.permissions ?? [],
  accessToken: initial?.accessToken ?? null,
  status: initial ? 'authenticated' : 'loading',
};

const listeners = new Set<() => void>();

function emit(next: AuthSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export const authStore = {
  getSnapshot: (): AuthSnapshot => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getAccessToken: (): string | null => snapshot.accessToken,
  getRefreshToken: (): string | null => null,
  setSession: (input: {
    user: AuthUser;
    permissions: Permission[];
    accessToken: string;
  }) => {
    writeStorage(input);
    emit({
      user: input.user,
      permissions: input.permissions,
      accessToken: input.accessToken,
      status: 'authenticated',
    });
  },
  setAnonymous: () => {
    writeStorage(null);
    emit({
      user: null,
      permissions: [],
      accessToken: null,
      status: 'anonymous',
    });
  },
  setUser: (user: AuthUser, permissions: Permission[]) => {
    if (!snapshot.accessToken) return;
    writeStorage({ user, permissions, accessToken: snapshot.accessToken });
    emit({ ...snapshot, user, permissions, status: 'authenticated' });
  },
};

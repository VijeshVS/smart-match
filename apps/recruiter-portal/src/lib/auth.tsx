import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  ApiClientError,
  authApi,
  authStore,
  bootstrapSession,
  recruiterApi,
  toApiClientError,
  type AuthSnapshot,
  type RecruiterProfileContext,
} from '@talent-ai/api-client';

export type OrgStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

interface AuthContextValue {
  snapshot: AuthSnapshot;
  ready: boolean;
  org: RecruiterProfileContext | null;
  orgStatus: OrgStatus;
  orgError: string | null;
  isRecruiter: boolean;
  setOrg: (context: RecruiterProfileContext) => void;
  reloadOrg: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getSnapshot,
  );

  const [ready, setReady] = useState(false);
  const [org, setOrg] = useState<RecruiterProfileContext | null>(null);
  const [orgStatus, setOrgStatus] = useState<OrgStatus>('idle');
  const [orgError, setOrgError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    bootstrapSession().finally(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const isRecruiter =
    snapshot.user?.role === 'RECRUITER' || snapshot.user?.role === 'ADMIN';

  const loadOrg = useCallback(async () => {
    if (!isRecruiter) return;

    setOrgStatus('loading');
    setOrgError(null);

    try {
      const context = await recruiterApi.getMe();
      setOrg(context);
      setOrgStatus('ready');
    } catch (error) {
      const apiError = toApiClientError(error);
      if (apiError instanceof ApiClientError && apiError.status === 404) {
        setOrgStatus('missing');
        return;
      }
      setOrgStatus('error');
      setOrgError(apiError.message);
    }
  }, [isRecruiter]);

  useEffect(() => {
    if (!ready || !isRecruiter) return;

    if (!org) {
      void loadOrg();
    }
  }, [ready, isRecruiter, org, loadOrg]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setOrg(null);
      setOrgStatus('idle');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      snapshot,
      ready,
      org,
      orgStatus,
      orgError,
      isRecruiter,
      setOrg: (context) => {
        setOrg(context);
        setOrgStatus('ready');
      },
      reloadOrg: loadOrg,
      signOut,
    }),
    [snapshot, ready, org, orgStatus, orgError, isRecruiter, loadOrg, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

export function useRequireRecruiter(): {
  recruiterId: string | null;
  organizationId: string | null;
} {
  const { org } = useAuth();
  return {
    recruiterId: org?.profile.id ?? null,
    organizationId: org?.organization.id ?? null,
  };
}

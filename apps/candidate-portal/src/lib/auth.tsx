import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { bootstrapSession, authStore, type AuthSnapshot } from '@talent-ai/api-client';

const AuthContext = createContext<AuthSnapshot | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot,
    authStore.getSnapshot,
  );

  useEffect(() => {
    void bootstrapSession();
  }, []);

  return <AuthContext.Provider value={snapshot}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthSnapshot {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  rewardsApi,
  toApiClientError,
  type LedgerTransaction,
  type Wallet,
} from '@talent-ai/api-client';

interface WalletContextValue {
  wallet: Wallet | null;
  transactions: LedgerTransaction[];
  loading: boolean;
  reload: () => Promise<void>;
  setWallet: (wallet: Wallet) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/** Shared TalentCredits state so the sidebar, dashboard and unlock flows agree. */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWalletState] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const summary = await rewardsApi.getWallet();
      setWalletState(summary.wallet);
      setTransactions(summary.transactions);
    } catch (error) {
      // A missing wallet is created lazily by the service; surface nothing here.
      if (toApiClientError(error).status !== 404) {
        setWalletState(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<WalletContextValue>(
    () => ({
      wallet,
      transactions,
      loading,
      reload,
      setWallet: (next) => setWalletState(next),
    }),
    [wallet, transactions, loading, reload],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used inside <WalletProvider>');
  return context;
}

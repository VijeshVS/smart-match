import { useState } from 'react';
import { Coins, Crown, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  ApiClientError,
  rewardsApi,
  toApiClientError,
  type TalentProfile,
} from '@talent-ai/api-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { useWallet } from '@/lib/wallet';
import { formatNumber } from '@/lib/format';

export function UnlockDialog({
  profile,
  open,
  onOpenChange,
  onUnlocked,
}: {
  profile: TalentProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked: (talentId: string) => void;
}) {
  const { wallet, reload, setWallet } = useWallet();
  const [pending, setPending] = useState(false);

  if (!profile) return null;

  const balance = wallet?.balance ?? 0;
  const cost = 50;
  const affordable = balance >= cost;

  const handleUnlock = async () => {
    setPending(true);
    try {
      const result = await rewardsApi.unlockTier3({ talentId: profile.id });
      setWallet(result.wallet);
      onUnlocked(profile.id);
      toast.success(
        result.chargedCredits === 0
          ? `${profile.name} was already unlocked`
          : `Unlocked ${profile.name} for ${result.chargedCredits} TC`,
      );
      onOpenChange(false);
      void reload();
    } catch (cause) {
      const error = toApiClientError(cause);
      if (error instanceof ApiClientError && error.status === 402) {
        toast.error(`You need ${cost} TC to unlock this profile. Earn credits by reviewing.`);
      } else {
        toast.error(error.message);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-warning/10 text-warning">
            <Crown />
          </AlertDialogMedia>
          <AlertDialogTitle>Unlock {profile.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Elite Principal profiles are gated. Unlocking shares verified contact details and
            full experience for this candidate.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Coins className="size-4 text-brand-cyan" /> Cost
          </span>
          <span className="font-semibold">{cost} TC</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Your balance</span>
          <span className={affordable ? 'font-semibold' : 'font-semibold text-destructive'}>
            {wallet ? `${formatNumber(balance)} TC` : 'Loading…'}
          </span>
        </div>

        {!affordable ? (
          <p className="flex items-start gap-2 text-xs text-warning">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            You need {cost - balance} more TalentCredits. Submit actionable reviews to earn 5 TC
            each.
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || !affordable}
            onClick={(event) => {
              event.preventDefault();
              void handleUnlock();
            }}
          >
            {pending ? <Spinner data-icon="inline-start" /> : <Crown data-icon="inline-start" />}
            {pending ? 'Unlocking…' : `Unlock for ${cost} TC`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

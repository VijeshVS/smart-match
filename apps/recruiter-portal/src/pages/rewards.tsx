import { useCallback, useEffect, useState } from 'react';
import { Check, Clipboard, Gift, Loader2, WalletCards } from 'lucide-react';
import {
  rewardsApi,
  toApiClientError,
  type RewardCatalogItem,
  type RewardCategory,
  type RewardRedemption,
} from '@talent-ai/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWallet } from '@/lib/wallet';
import { formatNumber } from '@/lib/format';

const categories: { value: RewardCategory; label: string }[] = [
  { value: 'ALL', label: 'All rewards' },
  { value: 'FOOD', label: 'Food & Dining' },
  { value: 'SHOPPING', label: 'Shopping' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
];

function Voucher({ redemption }: { redemption: RewardRedemption }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(redemption.couponCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{redemption.reward.brand}</CardTitle>
          <Badge>{redemption.reward.discount}</Badge>
        </div>
        <CardDescription>{redemption.reward.title}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-lg border border-dashed p-3">
          <code className="font-semibold tracking-wider">{redemption.couponCode}</code>
          <Button size="sm" variant="outline" onClick={() => void copy()}>
            {copied ? <Check data-icon="inline-start" /> : <Clipboard data-icon="inline-start" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Redeemed {new Date(redemption.redeemedAt).toLocaleDateString()}
          {redemption.expiresAt
            ? ` · Expires ${new Date(redemption.expiresAt).toLocaleDateString()}`
            : ''}
        </p>
        <p className="text-xs text-muted-foreground">{redemption.reward.terms.join(' · ')}</p>
      </CardContent>
    </Card>
  );
}

export function RewardsPage() {
  const { wallet, reload } = useWallet();
  const [category, setCategory] = useState<RewardCategory>('ALL');
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [selected, setSelected] = useState<RewardCatalogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<RewardRedemption | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [items, claimed] = await Promise.all([
        rewardsApi.getCatalog(category),
        rewardsApi.getRedemptions(),
      ]);
      setCatalog(items);
      setRedemptions(claimed);
    } catch (err) {
      setError(toApiClientError(err).message);
    } finally {
      setLoading(false);
    }
  }, [category]);
  useEffect(() => {
    void load();
  }, [load]);

  const redeem = async () => {
    if (!selected) return;
    setRedeeming(true);
    setError(null);
    try {
      const result = await rewardsApi.redeem({
        rewardId: selected.id,
        requestId: crypto.randomUUID(),
      });
      setSuccess(result.redemption);
      setSelected(null);
      setRedemptions((items) => [result.redemption, ...items]);
      await reload();
    } catch (err) {
      setError(toApiClientError(err).message);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Turn reviews into real-world perks</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Rewards Store</h1>
        </div>
        <Badge variant="outline" className="gap-2 px-3 py-2">
          <WalletCards className="size-4 text-brand-cyan" />
          {wallet ? `${formatNumber(wallet.balance)} TC available` : 'Wallet loading'}
        </Badge>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>We couldn’t complete that request</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert>
          <Check />
          <AlertTitle>Voucher claimed: {success.couponCode}</AlertTitle>
          <AlertDescription>
            Copy your code below in My Vouchers. Your wallet balance has been updated.
          </AlertDescription>
        </Alert>
      ) : null}
      <Tabs defaultValue="store">
        <TabsList>
          <TabsTrigger value="store">Browse rewards</TabsTrigger>
          <TabsTrigger value="vouchers">My Vouchers ({redemptions.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="store" className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={category === item.value ? 'default' : 'outline'}
                onClick={() => setCategory(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : catalog.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
                <Gift className="size-8 text-muted-foreground" />
                <p className="font-medium">No rewards available in this category</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {catalog.map((item) => (
                <Card key={item.id} className="glass flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant="secondary">{item.category}</Badge>
                      <span className="font-semibold text-brand-cyan">{item.cost} TC</span>
                    </div>
                    <CardTitle>{item.brand}</CardTitle>
                    <CardDescription>{item.title}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <p className="text-sm font-medium">{item.discount}</p>
                    <Button
                      className="mt-auto"
                      disabled={!item.available}
                      onClick={() => setSelected(item)}
                    >
                      {item.available ? 'Redeem reward' : 'Out of stock'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="vouchers" className="grid gap-4 md:grid-cols-2">
          {redemptions.length ? (
            redemptions.map((item) => <Voucher key={item.id} redemption={item} />)
          ) : (
            <Card className="md:col-span-2">
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Your claimed vouchers will appear here.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem {selected?.brand} voucher?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <p>{selected?.title}</p>
            <p className="text-muted-foreground">
              This will debit <strong>{selected?.cost} TalentCredits</strong> from your wallet. You
              have <strong>{wallet?.balance ?? 0} TC</strong>.
            </p>
            <p className="text-xs text-muted-foreground">{selected?.terms.join(' · ')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              disabled={redeeming || !wallet || wallet.balance < (selected?.cost ?? Infinity)}
              onClick={() => void redeem()}
            >
              {redeeming ? 'Claiming…' : 'Confirm redemption'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

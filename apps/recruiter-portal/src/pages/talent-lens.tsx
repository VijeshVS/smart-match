import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Coins,
  Crown,
  LockKeyhole,
  ScanSearch,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  aiApi,
  talentApi,
  toApiClientError,
  TALENT_CREDIT_RULES,
  TALENT_LEVELS,
  TALENT_LEVEL_LABELS,
  type TalentLevel,
  type TalentLensMatch,
  type TalentLensResponse,
  type TalentProfile,
} from '@talent-ai/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { LevelBadge } from '@/components/candidate-card';
import { CandidateDialog } from '@/components/candidate-dialog';
import { UnlockDialog } from '@/components/unlock-dialog';
import { useAuth } from '@/lib/auth';
import { useRecruiterPipeline } from '@/lib/recruiter-pipeline';
import { useWallet } from '@/lib/wallet';
import { formatNumber, formatPercent } from '@/lib/format';

const ALL = 'ALL';

const EXAMPLE_QUERIES = [
  'Senior backend engineer with Go and distributed systems experience',
  'Product-minded frontend engineer strong in React and TypeScript',
  'ML engineer with production LLM and vector search experience',
  'Elite platform engineer who has scaled Kubernetes clusters',
];

export function TalentLensPage() {
  const { org } = useAuth();
  const recruiterId = org?.profile.id ?? null;
  const { unlockedIds, isInterested, isInterestPending, toggleInterest, markUnlocked } =
    useRecruiterPipeline(recruiterId);
  const { wallet, setWallet, reload: reloadWallet } = useWallet();

  const queryCost = TALENT_CREDIT_RULES.TALENT_LENS_QUERY_COST;
  const balance = wallet?.balance ?? null;
  const belowCost = balance !== null && balance < queryCost;

  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState('10');
  const [level, setLevel] = useState<TalentLevel | typeof ALL>(ALL);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<TalentLensResponse | null>(null);

  const [selected, setSelected] = useState<TalentProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<TalentProfile | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);

  // `belowCost` also clears itself once the wallet is topped up elsewhere (for
  // example after earning credits in TalentSwipe).
  const blocked = belowCost;

  const runSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const trimmed = query.trim();

    if (blocked) return;

    if (trimmed.length < 3) {
      setError('Describe the hire you need in at least 3 characters.');
      return;
    }

    setPending(true);
    setError(null);

    try {
      const result = await aiApi.talentLens({
        query: trimmed,
        limit: Number(limit),
        ...(level !== ALL ? { filters: { level } } : {}),
        requestId: crypto.randomUUID(),
      });
      setResponse(result);
      // Reflect the debit immediately, then refresh the ledger in the
      // background so the sidebar and history stay in sync.
      setWallet(result.wallet);
      void reloadWallet();
      if (result.results.length === 0) {
        toast.info('No matches yet — try a broader description.');
      }
    } catch (cause) {
      const apiError = toApiClientError(cause);
      if (apiError.code === 'INSUFFICIENT_CREDITS' || apiError.status === 402) {
        setError(null);
        void reloadWallet();
        toast.error(`A TalentLens search costs ${queryCost} TC. Earn credits in TalentSwipe.`);
      } else {
        setError(apiError.message);
      }
    } finally {
      setPending(false);
    }
  };

  const isLocked = (match: TalentLensMatch) =>
    match.profile.level === 'LEVEL_3_LEAD' && !unlockedIds.has(match.talentId);

  const openProfile = async (match: TalentLensMatch, intent: 'view' | 'unlock' = 'view') => {
    setLoadingProfileId(match.talentId);
    try {
      const profile = await talentApi.getProfile(match.talentId);
      if (intent === 'unlock') {
        setUnlockTarget(profile);
        setUnlockOpen(true);
      } else {
        setSelected(profile);
        setDetailOpen(true);
      }
    } catch (cause) {
      toast.error(toApiClientError(cause).message);
    } finally {
      setLoadingProfileId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="relative overflow-hidden border-white/10 bg-gradient-to-br from-primary/20 via-card to-brand-cyan/10">
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanSearch className="size-4 text-brand-cyan" />
            TalentLens
          </CardTitle>
          <CardDescription>
            Describe the hire in plain language. TalentLens ranks the talent graph with explainable
            scores. Each search costs {queryCost} TalentCredits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={runSearch}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="lens-query">What are you hiring for?</FieldLabel>
                <Textarea
                  id="lens-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. Staff backend engineer with Go, Kubernetes and a track record of scaling payments infrastructure"
                  className="min-h-24 resize-y bg-background/40"
                  maxLength={2000}
                  disabled={blocked}
                />
                <FieldDescription>
                  Mention skills, seniority and domain. Add a tier filter to narrow the search.
                </FieldDescription>
              </Field>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field>
                  <FieldLabel>Results</FieldLabel>
                  <Select value={limit} onValueChange={setLimit}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Top 5</SelectItem>
                      <SelectItem value="10">Top 10</SelectItem>
                      <SelectItem value="20">Top 20</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Tier</FieldLabel>
                  <Select
                    value={level}
                    onValueChange={(value) => setLevel(value as TalentLevel | typeof ALL)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Any tier</SelectItem>
                      {TALENT_LEVELS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {TALENT_LEVEL_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="flex flex-col gap-2 sm:w-48">
                  <Button type="submit" disabled={pending || blocked} className="w-full">
                    {pending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Wand2 data-icon="inline-start" />
                    )}
                    {pending ? 'Searching…' : 'Find matches'}
                  </Button>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Coins className="size-3 text-brand-cyan" />
                      {queryCost} TC
                    </span>
                    <span className={belowCost ? 'font-medium text-destructive' : undefined}>
                      Balance: {wallet ? `${formatNumber(wallet.balance)} TC` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </FieldGroup>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuery(example)}
                className="rounded-full border bg-background/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {blocked ? (
        <Alert>
          <Coins />
          <AlertTitle>Not enough TalentCredits</AlertTitle>
          <AlertDescription>
            A TalentLens search costs {queryCost} TC and your balance is{' '}
            {balance !== null ? `${formatNumber(balance)} TC` : 'still loading'}. Evaluate
            candidates in TalentSwipe to earn credits.
            <div className="mt-3">
              <Button asChild size="sm">
                <Link to="/swipe">
                  <Coins data-icon="inline-start" />
                  Earn credits in TalentSwipe
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {error && !blocked ? (
        <Alert variant="destructive">
          <ScanSearch />
          <AlertTitle>Search failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {pending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
      ) : !response ? (
        <Empty className="glass">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles />
            </EmptyMedia>
            <EmptyTitle>Your next great hire is one sentence away</EmptyTitle>
            <EmptyDescription>
              TalentLens combines verified skills, experience and engagement signal to rank
              candidates. Start with a description above.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : response.results.length === 0 ? (
        <Empty className="glass">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScanSearch />
            </EmptyMedia>
            <EmptyTitle>No matches for that description</EmptyTitle>
            <EmptyDescription>
              Try broader language, fewer constraints, or a different tier. The query was assessed
              by {response.provider === 'local' ? 'the local engine' : response.provider}.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{response.results.length}</span> matches
              for “{response.query}”
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">engine: {response.provider}</Badge>
              {response.fallback ? <Badge variant="secondary">deterministic fallback</Badge> : null}
              {response.cached ? <Badge variant="secondary">cached</Badge> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {response.results.map((match, index) => {
              const locked = isLocked(match);
              const score = Math.round(match.score * 100);

              return (
                <Card key={match.talentId} className="glass card-hover justify-between">
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{match.profile.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {match.profile.field} · {formatNumber(match.profile.experienceYears)}{' '}
                            yrs
                          </p>
                        </div>
                      </div>
                      <LevelBadge level={match.profile.level} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Match score</span>
                        <span className="font-semibold">{formatPercent(match.score)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-brand-cyan transition-all"
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-4">
                    {match.matchedSkills.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Matched skills
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {match.matchedSkills.map((skill) => (
                            <Badge key={skill} variant="secondary" className="font-normal">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {match.strengths.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          Strengths
                        </p>
                        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                          {match.strengths.slice(0, 3).map((strength) => (
                            <li key={strength} className="flex items-start gap-1.5">
                              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand-cyan" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {match.rationale ? (
                      <p className="line-clamp-3 text-xs text-muted-foreground">
                        {match.rationale}
                      </p>
                    ) : null}

                    <Button
                      variant={isInterested(match.talentId) ? 'secondary' : 'outline'}
                      className="w-full justify-center gap-1.5"
                      disabled={isInterestPending(match.talentId)}
                      onClick={() => void toggleInterest(match.talentId)}
                    >
                      {isInterestPending(match.talentId) ? (
                        <Spinner data-icon="inline-start" />
                      ) : isInterested(match.talentId) ? (
                        <BookmarkCheck data-icon="inline-start" />
                      ) : (
                        <Bookmark data-icon="inline-start" />
                      )}
                      {isInterested(match.talentId)
                        ? 'Interested · In your pipeline'
                        : 'Mark as interested'}
                    </Button>

                    <Separator />

                    {locked ? (
                      <p className="flex items-start gap-1.5 text-xs text-warning">
                        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
                        Elite Principal profile — unlock to reveal verified contacts.
                      </p>
                    ) : null}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={loadingProfileId === match.talentId}
                        onClick={() => void openProfile(match)}
                      >
                        {loadingProfileId === match.talentId ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <ArrowUpRight data-icon="inline-end" />
                        )}
                        View profile
                      </Button>
                      {locked ? (
                        <Button
                          className="flex-1 gap-1.5"
                          disabled={loadingProfileId === match.talentId}
                          onClick={() => void openProfile(match, 'unlock')}
                        >
                          <Crown className="size-4" />
                          Unlock
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <CandidateDialog
        profile={selected}
        locked={
          selected ? selected.level === 'LEVEL_3_LEAD' && !unlockedIds.has(selected.id) : false
        }
        interested={selected ? isInterested(selected.id) : false}
        interestPending={selected ? isInterestPending(selected.id) : false}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUnlock={() => {
          if (selected) {
            setUnlockTarget(selected);
            setUnlockOpen(true);
            setDetailOpen(false);
          }
        }}
        onToggleInterest={() => {
          if (selected) void toggleInterest(selected.id);
        }}
      />

      <UnlockDialog
        profile={unlockTarget}
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={(talentId) => markUnlocked(talentId)}
      />
    </div>
  );
}

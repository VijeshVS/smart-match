import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Coins,
  ExternalLink,
  EyeOff,
  GraduationCap,
  Keyboard,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  engagementApi,
  rewardsApi,
  talentApi,
  toApiClientError,
  TALENT_CREDIT_RULES,
  type BlindTalentProfile,
  type LedgerTransaction,
  type SwipeDecision,
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
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewDialog, type ReviewSubmission } from '@/components/review-dialog';
import { useWallet } from '@/lib/wallet';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const SWIPE_THRESHOLD = 110;
const QUEUE_PAGE_SIZE = 100;
const CREDIT_POLL_ATTEMPTS = 6;
const CREDIT_POLL_INTERVAL_MS = 700;

interface DragState {
  x: number;
  y: number;
  active: boolean;
}

const NO_DRAG: DragState = { x: 0, y: 0, active: false };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function formatDuration(months: number): string {
  if (months <= 0) return '—';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (rest > 0) parts.push(`${rest} mo`);
  return parts.join(' ');
}

export function TalentSwipePage() {
  const { reload: reloadWallet } = useWallet();

  const [queue, setQueue] = useState<BlindTalentProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drag, setDrag] = useState<DragState>(NO_DRAG);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  const [pending, setPending] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<BlindTalentProfile | null>(null);
  const [reviewDecision, setReviewDecision] = useState<SwipeDecision>('APPROVE');
  const [reviewSwipeId, setReviewSwipeId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(0);
  const [sessionCredits, setSessionCredits] = useState(0);
  const creditedReferences = useRef(new Set<string>());

  const current = queue[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The API already excludes candidates this recruiter has screened. Walk
      // every page so the deck contains the full remaining pool, not just the
      // first batch.
      const profiles: BlindTalentProfile[] = [];
      let page = 1;
      for (;;) {
        const result = await talentApi.listBlindProfiles({ page, limit: QUEUE_PAGE_SIZE });
        profiles.push(...result.data);
        if (!result.meta.hasNextPage) break;
        page += 1;
      }
      setQueue(profiles);
      setTotal(profiles.length);
    } catch (cause) {
      setError(toApiClientError(cause).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = useCallback(() => {
    setDrag(NO_DRAG);
    pointerOrigin.current = null;
    // Remove the handled candidate from the in-memory deck immediately. The
    // next profile slides into the front of the queue.
    setQueue((items) => items.slice(1));
  }, []);

  /**
   * Rewards are applied by an asynchronous consumer. Poll the wallet for the
   * matching ledger entry so the recruiter sees a confirmed balance change
   * instead of an optimistic claim.
   */
  const confirmCredit = useCallback(
    async (
      type: LedgerTransaction['type'],
      referenceId: string,
      label: string,
      requestedAt: string,
    ) => {
      if (creditedReferences.current.has(referenceId)) return;

      // Allow a little clock skew between the portal and the rewards service.
      const earliest = Date.parse(requestedAt) - 5_000;

      for (let attempt = 0; attempt < CREDIT_POLL_ATTEMPTS; attempt += 1) {
        try {
          const summary = await rewardsApi.getWallet();
          const match = summary.transactions.find(
            (transaction) => transaction.type === type && transaction.referenceId === referenceId,
          );

          if (match) {
            creditedReferences.current.add(referenceId);
            void reloadWallet();

            if (Date.parse(match.createdAt) >= earliest) {
              setSessionCredits((value) => value + match.amount);
              toast.success(
                `+${match.amount} TalentCredit${match.amount === 1 ? '' : 's'} awarded`,
                { description: label },
              );
            } else {
              toast.info('TalentCredit already awarded', {
                description: `${label} This action was rewarded earlier.`,
              });
            }
            return;
          }
        } catch {
          // Keep polling; a transient wallet read must not hide a saved action.
        }

        if (attempt < CREDIT_POLL_ATTEMPTS - 1) {
          await delay(CREDIT_POLL_INTERVAL_MS);
        }
      }

      void reloadWallet();
      toast.info('TalentCredit pending', {
        description: `${label} It will appear in your wallet as soon as the reward settles.`,
      });
    },
    [reloadWallet],
  );

  const decide = useCallback(
    async (decision: SwipeDecision) => {
      if (!current || pending || reviewOpen) return;

      setPending(true);
      try {
        const requestedAt = new Date().toISOString();
        const swipe = await engagementApi.recordSwipe({ talentId: current.id, decision });
        setReviewDecision(decision);
        setReviewTarget(current);
        setReviewSwipeId(swipe.id);
        setReviewOpen(true);
        toast.success(
          decision === 'APPROVE'
            ? `${current.candidateRef} advanced to review`
            : decision === 'REJECT'
              ? `${current.candidateRef} rejected`
              : `${current.candidateRef} deferred for later review`,
        );

        if (decision !== 'DEFER') {
          void confirmCredit('CREDIT_SWIPE_DECISION', swipe.id, 'Decision recorded.', requestedAt);
        }
      } catch (cause) {
        toast.error(toApiClientError(cause).message);
        setDrag(NO_DRAG);
      } finally {
        setPending(false);
      }
    },
    [current, pending, reviewOpen, confirmCredit],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isDefer = event.key === 'ArrowDown' || key === 'd';
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && !isDefer) return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) return;
      }
      event.preventDefault();
      void decide(
        event.key === 'ArrowRight' ? 'APPROVE' : event.key === 'ArrowLeft' ? 'REJECT' : 'DEFER',
      );
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [decide]);

  const handleReviewSubmit = async (submission: ReviewSubmission) => {
    if (!reviewTarget) return;

    try {
      const requestedAt = new Date().toISOString();
      const result = await engagementApi.submitReview({
        talentId: reviewTarget.id,
        decision: reviewDecision,
        ...(reviewSwipeId ? { swipeId: reviewSwipeId } : {}),
        ...submission,
      });

      if (result.created) setReviewed((value) => value + 1);

      toast.success(result.updated ? 'Review updated' : 'Review submitted', {
        description: `Candidate feedback earns +${TALENT_CREDIT_RULES.REVIEW_FEEDBACK_REWARD} TalentCredits.`,
      });
      void confirmCredit(
        'CREDIT_REVIEW_FEEDBACK',
        result.review.id,
        'Candidate feedback confirmed.',
        requestedAt,
      );
    } catch (cause) {
      // The dialog owns the inline error state and surfaces the message.
      throw cause;
    }
    // The dialog closes itself after a successful submit; `onOpenChange`
    // advances the queue exactly once for both submit and skip.
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pending || reviewOpen) return;
    // Capturing the pointer on the card retargets click events, which would
    // make the Approve/Reject/Defer buttons inside it unclickable.
    if (
      event.target instanceof Element &&
      event.target.closest('button, a, input, textarea, select, [role="button"]')
    ) {
      return;
    }
    pointerOrigin.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerOrigin.current) return;
    setDrag({
      x: event.clientX - pointerOrigin.current.x,
      y: event.clientY - pointerOrigin.current.y,
      active: true,
    });
  };

  const onPointerUp = () => {
    if (!pointerOrigin.current) return;
    const distance = drag.x;

    if (Math.abs(distance) >= SWIPE_THRESHOLD) {
      void decide(distance > 0 ? 'APPROVE' : 'REJECT');
    } else {
      setDrag(NO_DRAG);
    }
    pointerOrigin.current = null;
  };

  const completed = Math.max(0, total - queue.length);
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const intent = drag.x > 40 ? 'APPROVE' : drag.x < -40 ? 'REJECT' : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="glass overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shuffle className="size-4 text-brand-cyan" />
                TalentSwipe
              </CardTitle>
              <CardDescription>
                Blind review: personal details and Elite status stay hidden. Swipe right to approve,
                left to reject, or defer for later.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <Keyboard className="size-3.5" />← →
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {Math.min(completed + (current ? 1 : 0), total)} / {total}
              </span>
            </div>

            {error ? (
              <Alert variant="destructive">
                <Shuffle />
                <AlertTitle>Could not load the swipe queue</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {loading ? (
              <Skeleton className="mx-auto h-[30rem] w-full max-w-md rounded-2xl" />
            ) : !current ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CheckCircle2 />
                  </EmptyMedia>
                  <EmptyTitle>All caught up</EmptyTitle>
                  <EmptyDescription>
                    {reviewed > 0
                      ? `You reviewed ${reviewed} candidate${reviewed === 1 ? '' : 's'} in this session. New profiles will appear here as they join the platform.`
                      : 'You have reviewed every available candidate. New profiles will appear here as they join the platform.'}
                  </EmptyDescription>
                </EmptyHeader>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => void load()}>
                    <RotateCcw data-icon="inline-start" />
                    Reload queue
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/candidates">Browse directory</Link>
                  </Button>
                </div>
              </Empty>
            ) : (
              <div className="relative mx-auto w-full max-w-md select-none">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-6 top-4 h-full rounded-2xl border bg-card/40"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-3 top-2 h-full rounded-2xl border bg-card/60"
                />
                <div
                  role="group"
                  aria-label={`Blind candidate ${current.candidateRef}`}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className={cn(
                    'relative flex min-h-[30rem] cursor-grab touch-none flex-col gap-4 rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40',
                    drag.active ? 'cursor-grabbing' : 'transition-transform duration-200',
                  )}
                  style={{
                    transform: `translate(${drag.x}px, ${drag.y * 0.12}px) rotate(${drag.x / 22}deg)`,
                  }}
                >
                  {intent ? (
                    <div
                      className={cn(
                        'pointer-events-none absolute top-5 rounded-md border-2 px-3 py-1 text-sm font-bold tracking-widest uppercase',
                        intent === 'APPROVE'
                          ? 'right-5 rotate-6 border-success text-success'
                          : 'left-5 -rotate-6 border-destructive text-destructive',
                      )}
                    >
                      {intent === 'APPROVE' ? 'Approve' : 'Reject'}
                    </div>
                  ) : null}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge variant="outline" className="gap-1.5">
                        <EyeOff className="size-3" />
                        Blind review
                      </Badge>
                      <p className="mt-2 truncate font-heading text-xl font-semibold">
                        {current.candidateRef}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{current.field}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {formatNumber(current.experienceYears)} yrs
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {current.skills.slice(0, 8).map((skill) => (
                      <Badge key={skill} variant="secondary" className="font-normal">
                        {skill}
                      </Badge>
                    ))}
                    {current.skills.length > 8 ? (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        +{current.skills.length - 8}
                      </Badge>
                    ) : null}
                  </div>

                  <Separator />

                  <section className="flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      <GraduationCap className="size-3.5 text-brand-cyan" />
                      Education
                    </p>
                    {current.education.length > 0 ? (
                      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                        {current.education.slice(0, 2).map((entry, entryIndex) => (
                          <li key={`${entry.college}-${entryIndex}`} className="truncate">
                            {entry.degree} · {entry.branchOfStudy} · {entry.college} (
                            {entry.yearOfGraduation})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No education listed</p>
                    )}
                  </section>

                  <section className="flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      <BriefcaseBusiness className="size-3.5 text-brand-cyan" />
                      Experience
                    </p>
                    {current.previousExperience.length > 0 ? (
                      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                        {current.previousExperience.slice(0, 2).map((entry, entryIndex) => (
                          <li key={`${entry.company}-${entry.role}-${entryIndex}`}>
                            <p className="truncate font-medium text-foreground">
                              {entry.role} · {entry.company}
                            </p>
                            <p className="text-xs">
                              {formatDuration(entry.durationMonths)}
                              {entry.responsibilities[0] ? ` · ${entry.responsibilities[0]}` : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No work history listed</p>
                    )}
                  </section>

                  {current.portfolioUrl || current.githubUrl ? (
                    <div className="flex flex-wrap gap-2">
                      {current.portfolioUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={current.portfolioUrl} target="_blank" rel="noreferrer noopener">
                            <ExternalLink data-icon="inline-start" />
                            Portfolio
                          </a>
                        </Button>
                      ) : null}
                      {current.githubUrl ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={current.githubUrl} target="_blank" rel="noreferrer noopener">
                            <ExternalLink data-icon="inline-start" />
                            Work samples
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        disabled={pending}
                        onClick={() => void decide('REJECT')}
                      >
                        <XCircle data-icon="inline-start" />
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        disabled={pending}
                        onClick={() => void decide('DEFER')}
                      >
                        <Clock3 data-icon="inline-start" />
                        Defer
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={pending}
                        onClick={() => void decide('APPROVE')}
                      >
                        <CheckCircle2 data-icon="inline-start" />
                        Approve
                      </Button>
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      Accept or reject earns +{TALENT_CREDIT_RULES.SWIPE_DECISION_REWARD}{' '}
                      TalentCredit. Feedback earns +{TALENT_CREDIT_RULES.REVIEW_FEEDBACK_REWARD}.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ArrowLeft className="size-3.5" /> Reject
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-1.5">
                <ArrowDown className="size-3.5" /> Defer
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-1.5">
                <ArrowRight className="size-3.5" /> Approve
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span>Drag the card, use the arrow keys, or press D to defer</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Why it works</CardTitle>
              <CardDescription>High-signal decisions, structured feedback.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-cyan" />
                Names, contact details and Elite status stay hidden. Only qualifications are
                visible.
              </p>
              <p className="flex items-start gap-2">
                <Coins className="mt-0.5 size-4 shrink-0 text-warning" />
                Accepting or rejecting earns +{TALENT_CREDIT_RULES.SWIPE_DECISION_REWARD}{' '}
                TalentCredit. Deferring earns none.
              </p>
              <p className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-cyan" />
                Candidate feedback earns +{TALENT_CREDIT_RULES.REVIEW_FEEDBACK_REWARD}{' '}
                TalentCredits.
              </p>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle className="text-base">Session</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Decisions</span>
                <span className="font-medium">{completed}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reviews submitted</span>
                <span className="font-medium">{reviewed}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">TalentCredits earned</span>
                <span className="font-medium text-warning">+{sessionCredits} TC</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RotateCcw data-icon="inline-start" />
                Reload queue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ReviewDialog
        profile={reviewTarget}
        decision={reviewDecision}
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open);
          if (!open) advance();
        }}
        onSubmit={handleReviewSubmit}
      />
    </div>
  );
}

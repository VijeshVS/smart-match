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
  GraduationCap,
  Keyboard,
  LockKeyhole,
  RotateCcw,
  Shuffle,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  engagementApi,
  talentApi,
  toApiClientError,
  TALENT_CREDIT_RULES,
  type SwipeDecision,
  type TalentProfile,
} from '@talent-ai/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/candidate-card';
import { ReviewDialog, type ReviewSubmission } from '@/components/review-dialog';
import { UnlockDialog } from '@/components/unlock-dialog';
import { useAuth } from '@/lib/auth';
import { useUnlockedTalent } from '@/lib/unlocked';
import { useWallet } from '@/lib/wallet';
import { formatNumber, initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const SWIPE_THRESHOLD = 110;
const QUEUE_SIZE = 25;

interface DragState {
  x: number;
  y: number;
  active: boolean;
}

const NO_DRAG: DragState = { x: 0, y: 0, active: false };

export function TalentSwipePage() {
  const { reload: reloadWallet } = useWallet();
  const { org } = useAuth();
  const { unlocked, markUnlocked } = useUnlockedTalent(org?.profile.id ?? null);

  const [queue, setQueue] = useState<TalentProfile[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drag, setDrag] = useState<DragState>(NO_DRAG);
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null);

  const [pending, setPending] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<TalentProfile | null>(null);
  const [reviewDecision, setReviewDecision] = useState<SwipeDecision>('APPROVE');
  const [reviewed, setReviewed] = useState(0);
  const [unlockTarget, setUnlockTarget] = useState<TalentProfile | null>(null);

  const current = queue[index] ?? null;
  const locked = current
    ? current.level === 'LEVEL_3_LEAD' && !unlocked.has(current.id)
    : false;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await talentApi.listProfiles({ limit: QUEUE_SIZE });
      setQueue(result.data);
      setIndex(0);
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
    setIndex((value) => value + 1);
  }, []);

  const decide = useCallback(
    async (decision: SwipeDecision) => {
      if (!current || pending || reviewOpen) return;

      setPending(true);
      try {
        await engagementApi.recordSwipe({ talentId: current.id, decision });
        setReviewDecision(decision);
        setReviewTarget(current);
        setReviewOpen(true);
        toast.success(
          decision === 'APPROVE'
            ? `${current.name} advanced to review`
            : decision === 'REJECT'
              ? `${current.name} rejected`
              : `${current.name} deferred for later review`,
        );
      } catch (cause) {
        toast.error(toApiClientError(cause).message);
        setDrag(NO_DRAG);
      } finally {
        setPending(false);
      }
    },
    [current, pending, reviewOpen],
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
      await engagementApi.submitReview({
        talentId: reviewTarget.id,
        decision: reviewDecision,
        ...submission,
      });
      setReviewed((value) => value + 1);
      toast.success('Review submitted — actionable feedback earns TalentCredits');
      void reloadWallet();
      // The reward is credited by an async consumer; refresh again once it lands.
      window.setTimeout(() => void reloadWallet(), 2_000);
    } catch (cause) {
      toast.error(toApiClientError(cause).message);
      throw cause;
    }
    // The dialog closes itself after a successful submit; `onOpenChange`
    // advances the queue exactly once for both submit and skip.
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pending || reviewOpen) return;
    // Capturing the pointer on the card retargets click events, which would
    // make the Approve/Reject/Defer/Unlock buttons inside it unclickable.
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

  const progress = queue.length > 0 ? Math.min(100, Math.round((index / queue.length) * 100)) : 0;
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
                Swipe right to approve, left to reject, or defer for later. Every decision can carry
                a review.
              </CardDescription>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <Keyboard className="size-3.5" />
              ← →
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Progress value={progress} className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {Math.min(index + (current ? 1 : 0), queue.length)} / {queue.length}
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
              <Skeleton className="mx-auto h-[26rem] w-full max-w-md rounded-2xl" />
            ) : !current ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CheckCircle2 />
                  </EmptyMedia>
                  <EmptyTitle>You cleared the queue</EmptyTitle>
                  <EmptyDescription>
                    {reviewed > 0
                      ? `You reviewed ${reviewed} candidate${reviewed === 1 ? '' : 's'} in this session. Reload for a fresh batch or search the directory.`
                      : 'No verified candidates are waiting right now. Reload for a fresh batch or browse the directory.'}
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
                  aria-label={`Candidate ${current.name}`}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className={cn(
                    'relative flex min-h-[26rem] cursor-grab touch-none flex-col gap-4 rounded-2xl border bg-card p-6 shadow-2xl shadow-black/40',
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

                  <div className="flex items-start gap-4">
                    <Avatar className="size-16 rounded-2xl">
                      <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary/30 to-brand-cyan/20 text-lg font-semibold">
                        {initials(current.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading text-xl font-semibold">{current.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{current.field}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <LevelBadge level={current.level} />
                        <Badge variant="outline">
                          {formatNumber(current.experienceYears)} yrs
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {current.bio ? (
                    <p className="line-clamp-3 text-sm text-muted-foreground">{current.bio}</p>
                  ) : null}

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

                  {locked ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-warning/25 bg-warning/5 p-4">
                      <div className="flex items-start gap-3">
                        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-warning" />
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-medium">Elite Principal details locked</p>
                          <p className="text-xs text-muted-foreground">
                            Unlock with {TALENT_CREDIT_RULES.TIER3_UNLOCK_COST} TC to reveal
                            education and the full work history.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        onClick={() => setUnlockTarget(current)}
                      >
                        <Coins data-icon="inline-start" />
                        Unlock profile
                      </Button>
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <GraduationCap className="size-4 shrink-0 text-brand-cyan" />
                        <span className="truncate">
                          {current.education[0]
                            ? `${current.education[0].degree} · ${current.education[0].college}`
                            : 'No education listed'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <BriefcaseBusiness className="size-4 shrink-0 text-brand-cyan" />
                        <span className="truncate">
                          {current.previousExperience[0]
                            ? `${current.previousExperience[0].role} · ${current.previousExperience[0].company}`
                            : 'No work history listed'}
                        </span>
                      </li>
                    </ul>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-3 pt-2">
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
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-cyan" />
                Every swipe feeds the talent graph used by TalentLens.
              </p>
              <p className="flex items-start gap-2">
                <Coins className="mt-0.5 size-4 shrink-0 text-warning" />
                Actionable reviews earn +5 TalentCredits.
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                Approvals advance candidates into your review pipeline.
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
                <span className="font-medium">{index}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reviews submitted</span>
                <span className="font-medium">{reviewed}</span>
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

      <UnlockDialog
        profile={unlockTarget}
        open={Boolean(unlockTarget)}
        onOpenChange={(open) => {
          if (!open) setUnlockTarget(null);
        }}
        onUnlocked={(talentId) => {
          markUnlocked(talentId);
          void reloadWallet();
        }}
      />
    </div>
  );
}

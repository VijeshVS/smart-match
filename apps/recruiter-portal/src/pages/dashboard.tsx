import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Coins,
  Crown,
  ScanSearch,
  Shuffle,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import {
  analyticsApi,
  engagementApi,
  talentApi,
  toApiClientError,
  type FunnelAggregate,
  type RecruiterDashboard,
  type RecruiterEngagementHistory,
  type RecruiterLeaderboardEntry,
  type SkillAnalytics,
  type TalentProfile,
} from '@talent-ai/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { useAuth } from '@/lib/auth';
import { useWallet } from '@/lib/wallet';
import { formatNumber, formatPercent, formatRelativeTime, initials } from '@/lib/format';

interface DashboardData {
  dashboard: RecruiterDashboard;
  funnel: FunnelAggregate;
  leaderboard: RecruiterLeaderboardEntry[];
  skills: SkillAnalytics[];
  history: RecruiterEngagementHistory;
  talent: TalentProfile[];
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const toneClass = {
    default: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    danger: 'text-destructive bg-destructive/10',
    warning: 'text-warning bg-warning/10',
  }[tone];

  return (
    <Card className="glass">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          <span className={`inline-flex size-8 items-center justify-center rounded-lg ${toneClass}`}>
            <Icon className="size-4" />
          </span>
        </div>
        <p className="font-heading text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { org } = useAuth();
  const { wallet, transactions } = useWallet();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    setError(null);

    const recruiterId = org.profile.id;
    const results = await Promise.allSettled([
      analyticsApi.recruiterDashboard(recruiterId),
      analyticsApi.funnel(),
      analyticsApi.leaderboard(5),
      analyticsApi.skills(6),
      engagementApi.getRecruiterHistory(recruiterId),
      talentApi.listProfiles({ limit: 50 }),
    ]);

    const [dashboard, funnel, leaderboard, skills, history, talent] = results;

    if (dashboard.status === 'rejected') {
      setError(toApiClientError(dashboard.reason).message);
      setLoading(false);
      return;
    }

    setData({
      dashboard: dashboard.value,
      funnel:
        funnel.status === 'fulfilled'
          ? funnel.value
          : {
              periodStart: new Date().toISOString(),
              periodEnd: new Date().toISOString(),
              profilesCreated: 0,
              swipesRecorded: 0,
              reviewsSubmitted: 0,
              tier3Unlocks: 0,
              approvalRate: 0,
            },
      leaderboard: leaderboard.status === 'fulfilled' ? leaderboard.value : [],
      skills: skills.status === 'fulfilled' ? skills.value : [],
      history:
        history.status === 'fulfilled'
          ? history.value
          : { recruiterId, swipes: [], reviews: [] },
      talent: talent.status === 'fulfilled' ? talent.value.data : [],
    });
    setLoading(false);
  }, [org]);

  useEffect(() => {
    void load();
  }, [load]);

  const talentById = useMemo(() => {
    const map = new Map<string, TalentProfile>();
    for (const profile of data?.talent ?? []) map.set(profile.id, profile);
    return map;
  }, [data?.talent]);

  const unlockTransactions = transactions.filter(
    (transaction) => transaction.type === 'DEBIT_TIER3_UNLOCK',
  );

  if (!org) return null;

  return (
    <div className="flex flex-col gap-6">
      <Card className="relative overflow-hidden border-white/10 bg-gradient-to-br from-primary/20 via-card to-brand-cyan/10">
        <CardContent className="flex flex-col gap-6 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3">
            <Badge variant="outline" className="w-fit gap-1.5">
              <BadgeCheck className="size-3.5 text-success" />
              {org.organization.name}
            </Badge>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                Welcome back, {org.profile.fullName.split(' ')[0]}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Your pipeline, credits and talent graph in one place. Every review you submit
                trains sharper matches for the next search.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/swipe">
                  <Shuffle data-icon="inline-start" />
                  Start swiping
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/lens">
                  <ScanSearch data-icon="inline-start" />
                  Ask TalentLens
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-80">
            <div className="rounded-xl border bg-background/40 p-3">
              <p className="flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                <Coins className="size-3.5 text-brand-cyan" /> Credits
              </p>
              <p className="mt-1 font-heading text-2xl font-semibold">
                {wallet ? formatNumber(wallet.balance) : '—'}
              </p>
            </div>
            <div className="rounded-xl border bg-background/40 p-3">
              <p className="flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                <Star className="size-3.5 text-warning" /> Reviews
              </p>
              <p className="mt-1 font-heading text-2xl font-semibold">
                {data ? formatNumber(data.dashboard.candidatesReviewed) : '—'}
              </p>
            </div>
            <div className="rounded-xl border bg-background/40 p-3">
              <p className="flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
                <Crown className="size-3.5 text-primary" /> Unlocks
              </p>
              <p className="mt-1 font-heading text-2xl font-semibold">
                {formatNumber(unlockTransactions.length)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <Activity />
          <AlertTitle>Analytics unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !data ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32" />)
        ) : (
          <>
            <StatCard
              label="Candidates reviewed"
              value={formatNumber(data.dashboard.candidatesReviewed)}
              hint={`${data.dashboard.openJobs} open roles in your workspace`}
              icon={Users}
            />
            <StatCard
              label="Approvals"
              value={formatNumber(data.dashboard.approvals)}
              hint={`${formatPercent(data.funnel.approvalRate)} approval rate`}
              icon={ThumbsUp}
              tone="success"
            />
            <StatCard
              label="Rejections"
              value={formatNumber(data.dashboard.rejections)}
              hint={`${formatNumber(data.funnel.swipesRecorded)} swipes in this period`}
              icon={ThumbsDown}
              tone="danger"
            />
            <StatCard
              label="Credits earned"
              value={`${formatNumber(data.dashboard.creditsEarned)} TC`}
              hint={`${formatNumber(data.funnel.tier3Unlocks)} Elite profiles unlocked`}
              icon={Coins}
              tone="warning"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="glass xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-brand-cyan" />
              Hiring funnel
            </CardTitle>
            <CardDescription>Last 30 days across the talent.ai network.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loading || !data ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10" />)
            ) : (
              [
                { label: 'Profiles created', value: data.funnel.profilesCreated },
                { label: 'Swipes recorded', value: data.funnel.swipesRecorded },
                { label: 'Reviews submitted', value: data.funnel.reviewsSubmitted },
                { label: 'Tier-3 unlocks', value: data.funnel.tier3Unlocks },
              ].map((row) => {
                const max = Math.max(
                  data.funnel.profilesCreated,
                  data.funnel.swipesRecorded,
                  data.funnel.reviewsSubmitted,
                  data.funnel.tier3Unlocks,
                  1,
                );
                return (
                  <div key={row.label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">{formatNumber(row.value)}</span>
                    </div>
                    <Progress value={Math.round((row.value / max) * 100)} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Top skills in demand</CardTitle>
            <CardDescription>Demand versus verified supply.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loading || !data ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-8" />)
            ) : data.skills.length === 0 ? (
              <Empty className="border-0 p-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BriefcaseBusiness />
                  </EmptyMedia>
                  <EmptyTitle>No skill signal yet</EmptyTitle>
                  <EmptyDescription>
                    Skills appear once profiles and swipes flow through analytics.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              data.skills.map((skill) => {
                const ratio =
                  skill.supplyCount === 0
                    ? 0
                    : Math.min(100, Math.round((skill.demandCount / skill.supplyCount) * 100));
                return (
                  <div key={skill.skill} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>{skill.skill}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatNumber(skill.demandCount)} demand · {formatNumber(skill.supplyCount)} supply
                      </span>
                    </div>
                    <Progress value={ratio} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="glass xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Recent decisions</CardTitle>
              <CardDescription>Reviews you submitted most recently.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0">
              <Link to="/candidates">
                Directory
                <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading || !data ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-14" />
                ))}
              </div>
            ) : data.history.reviews.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Star />
                  </EmptyMedia>
                  <EmptyTitle>No reviews yet</EmptyTitle>
                  <EmptyDescription>
                    Swipe a candidate and leave actionable feedback to earn TalentCredits.
                  </EmptyDescription>
                </EmptyHeader>
                <Button asChild size="sm">
                  <Link to="/swipe">Open TalentSwipe</Link>
                </Button>
              </Empty>
            ) : (
              <ul className="flex flex-col">
                {data.history.reviews.slice(0, 6).map((review, index) => {
                  const profile = talentById.get(review.talentId);
                  return (
                    <li key={review.id}>
                      <div className="flex items-center gap-3 py-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                            {initials(profile?.name ?? 'Candidate')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {profile?.name ?? review.talentId.slice(0, 8)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {profile?.field ?? 'Verified talent'} ·{' '}
                            {formatRelativeTime(review.createdAt)}
                          </p>
                        </div>
                        <Badge variant={review.decision === 'APPROVE' ? 'default' : 'destructive'}>
                          {review.decision === 'APPROVE' ? 'Approved' : 'Rejected'}
                        </Badge>
                        {review.rating ? (
                          <span className="text-xs text-muted-foreground">{review.rating}/5</span>
                        ) : null}
                      </div>
                      {index < Math.min(data.history.reviews.length, 6) - 1 ? <Separator /> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Leaderboard</CardTitle>
            <CardDescription>Top reviewers by credits earned.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loading || !data ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10" />)
            ) : data.leaderboard.length === 0 ? (
              <p className="text-sm text-muted-foreground">No ranked recruiters yet.</p>
            ) : (
              data.leaderboard.map((entry) => (
                <div key={entry.recruiterId} className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                    {entry.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {entry.recruiterId === org.profile.id
                        ? 'You'
                        : `Recruiter ${entry.recruiterId.slice(0, 6)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(entry.reviewsSubmitted)} reviews
                    </p>
                  </div>
                  <span className="text-sm font-medium">{formatNumber(entry.creditsEarned)} TC</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

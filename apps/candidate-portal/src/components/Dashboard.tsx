import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Lightbulb,
  Mail,
  Phone,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import {
  aiApi,
  connectNotificationSocket,
  engagementApi,
  notificationsApi,
  talentApi,
  toApiClientError,
  TALENT_LEVEL_LABELS,
  type Notification,
  type ProfileSuggestionsResult,
  type ProfileSummaryResult,
  type TalentEngagementSummary,
  type TalentProfile,
} from '@talent-ai/api-client';
import { toast } from 'sonner';
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth';

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  hint: string;
  icon: typeof ThumbsUp;
  tone: string;
}) {
  return (
    <Card className="card-hover border-white/10 bg-card/60">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <CardDescription>{title}</CardDescription>
          <span className={`inline-flex size-9 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="size-4" />
          </span>
        </div>
        <p className="font-heading text-3xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function InsightCard({
  title,
  description,
  items,
  icon: Icon,
  accent,
  loading,
}: {
  title: string;
  description: string;
  items: string[];
  icon: typeof Sparkles;
  accent: string;
  loading: boolean;
}) {
  return (
    <Card className="card-hover border-white/10 bg-card/60">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className={`inline-flex size-10 items-center justify-center rounded-xl ${accent}`}>
            <Icon className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
            <Skeleton className="h-4 w-9/12" />
          </div>
        ) : items.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${accent}`} />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Insights will appear once your profile has been analysed.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { user, accessToken } = useAuth();
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [engagement, setEngagement] = useState<TalentEngagementSummary | null>(null);
  const [summary, setSummary] = useState<ProfileSummaryResult | null>(null);
  const [suggestions, setSuggestions] = useState<ProfileSuggestionsResult | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [missingProfile, setMissingProfile] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMissingProfile(false);

    try {
      const talent = await talentApi.getMyProfile();
      setProfile(talent);
      setLoading(false);

      const [engagementResult, summaryResult, suggestionResult, unreadCount] =
        await Promise.allSettled([
          engagementApi.getTalentSummary(talent.id),
          aiApi.summarizeProfile({
            talentId: talent.id,
            profile: {
              name: talent.name,
              field: talent.field,
              skills: talent.skills,
              experienceYears: talent.experienceYears,
              level: talent.level,
              education: talent.education,
              previousExperience: talent.previousExperience,
              bio: talent.bio,
            },
          }),
          aiApi.suggestImprovements({ talentId: talent.id }),
          notificationsApi.unreadCount(),
        ]);

      if (engagementResult.status === 'fulfilled') setEngagement(engagementResult.value);
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
      if (suggestionResult.status === 'fulfilled') setSuggestions(suggestionResult.value);
      if (unreadCount.status === 'fulfilled') setUnread(unreadCount.value);
    } catch (cause) {
      const apiError = toApiClientError(cause);
      if (apiError.status === 404) {
        setMissingProfile(true);
      } else {
        setError(apiError.message);
      }
      setLoading(false);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accessToken || !user) return;
    const handle = connectNotificationSocket({
      onNotification: (notification: Notification) => {
        setUnread((value) => value + 1);
        toast(notification.title, { description: notification.body });
      },
    });
    return () => handle.close();
  }, [accessToken, user]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-4">
          <Skeleton className="size-16 rounded-2xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (missingProfile) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16 sm:px-6">
        <Empty className="glass-strong border border-white/10">
          <EmptyHeader>
            <EmptyTitle>Your talent profile is not ready yet</EmptyTitle>
            <EmptyDescription>
              Complete the three-step onboarding wizard and we will start matching you instantly.
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild size="lg">
            <Link to="/register">Create your profile</Link>
          </Button>
        </Empty>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Alert variant="destructive">
          <AlertTitle>We couldn’t load your dashboard</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error || 'An unexpected error occurred.'}</span>
            <Button variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const levelLabel = TALENT_LEVEL_LABELS[profile.level] ?? profile.level;
  const approvals = engagement?.rightSwipes ?? 0;
  const rejections = engagement?.leftSwipes ?? 0;
  const totalSwipes = approvals + rejections;
  const acceptance = totalSwipes > 0 ? Math.round((approvals / totalSwipes) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 rounded-2xl">
            <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary to-brand-cyan text-xl font-bold text-white">
              {initials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-3xl font-extrabold tracking-tight">{profile.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="bg-primary/15 text-primary">
                {levelLabel}
              </Badge>
              <span>{profile.field}</span>
              <span aria-hidden="true">·</span>
              <span>{profile.experienceYears} yrs experience</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="relative">
            <Bell />
            {unread > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
            <span className="sr-only">{unread} unread notifications</span>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/register">Edit profile</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Approvals"
          value={approvals}
          hint="Recruiters who saved your profile"
          icon={ThumbsUp}
          tone="bg-success/15 text-success"
        />
        <StatCard
          title="Rejections"
          value={rejections}
          hint="Feedback helps refine your signal"
          icon={ThumbsDown}
          tone="bg-destructive/15 text-destructive"
        />
        <StatCard
          title="Acceptance rate"
          value={`${acceptance}%`}
          hint={`${totalSwipes} recruiter decisions`}
          icon={TrendingUp}
          tone="bg-brand-cyan/15 text-brand-cyan"
        />
        <StatCard
          title="Reviews"
          value={engagement?.totalReviews ?? 0}
          hint="Detailed recruiter feedback"
          icon={CheckCircle2}
          tone="bg-primary/15 text-primary"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="glass-strong border-white/10">
          <CardHeader>
            <CardTitle>Profile signal</CardTitle>
            <CardDescription>How your profile performs in the talent pool.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Acceptance confidence</span>
                <span className="font-medium">{acceptance}%</span>
              </div>
              <Progress value={acceptance} />
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium">Contact</span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="size-4" />
                <span className="truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="size-4" />
                <span>{profile.phone}</span>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Skills</span>
                <Badge variant="secondary">{profile.skills.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <Badge key={skill} variant="outline" className="border-primary/25 bg-primary/5">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <InsightCard
            title="Profile summary"
            description="AI-generated overview of your signal"
            items={summary?.summary ?? []}
            icon={Sparkles}
            accent="bg-brand-cyan/15 text-brand-cyan"
            loading={insightsLoading}
          />
          <InsightCard
            title="Suggestions to improve"
            description="Prioritised actions from the matching engine"
            items={suggestions?.suggestions ?? []}
            icon={Lightbulb}
            accent="bg-warning/15 text-warning"
            loading={insightsLoading}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <GraduationCap className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">Education</CardTitle>
                <CardDescription>{profile.education.length} entries</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {profile.education.length === 0 ? (
              <p className="text-sm text-muted-foreground">No education added yet.</p>
            ) : (
              profile.education.map((item, index) => (
                <div key={item.id ?? index} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.college}</p>
                    <span className="text-xs text-muted-foreground">
                      {item.yearOfGraduation}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.degree} · {item.branchOfStudy}
                  </p>
                  {item.gpa ? (
                    <Badge variant="outline" className="w-fit border-white/10">
                      GPA {item.gpa}
                    </Badge>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-cyan/15 text-brand-cyan">
                <Briefcase className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base">Experience</CardTitle>
                <CardDescription>{profile.previousExperience.length} roles</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {profile.previousExperience.length === 0 ? (
              <p className="text-sm text-muted-foreground">No work history added yet.</p>
            ) : (
              profile.previousExperience.map((item, index) => (
                <div key={item.id ?? index} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.role}</p>
                    <span className="text-xs text-muted-foreground">
                      {item.durationMonths} months
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.company}</p>
                  {item.responsibilities.length > 0 ? (
                    <ul className="flex flex-col gap-1.5">
                      {item.responsibilities.map((responsibility, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-cyan" />
                          <span>{responsibility}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border-white/10 bg-card/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-success/15 text-success">
              <CheckCircle2 className="size-4" />
            </span>
            <div>
              <CardTitle className="text-base">Recruiter feedback</CardTitle>
              <CardDescription>Everything reviewers have shared with you.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {engagement && engagement.reviews.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {engagement.reviews.map((review) => {
                const approved = review.decision === 'APPROVE';
                const deferred = review.decision === 'DEFER';
                return (
                  <div
                    key={review.id}
                    className={`flex flex-col gap-2 rounded-xl border p-4 ${
                      approved
                        ? 'border-success/20 bg-success/5'
                        : deferred
                          ? 'border-warning/20 bg-warning/5'
                          : 'border-destructive/20 bg-destructive/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {approved ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : deferred ? (
                        <Clock3 className="size-4 text-warning" />
                      ) : (
                        <XCircle className="size-4 text-destructive" />
                      )}
                      <span className="text-xs font-medium">
                        {approved ? 'Approved' : deferred ? 'Deferred' : 'Rejected'}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDate(review.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {review.feedbackText ?? 'No written feedback provided.'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty className="border border-none">
              <EmptyHeader>
                <EmptyTitle>No reviews yet</EmptyTitle>
                <EmptyDescription>
                  When recruiters review your profile, their feedback lands here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;

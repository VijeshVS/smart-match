import { useEffect, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Clock3,
  Crown,
  GraduationCap,
  LockKeyhole,
  Mail,
  Phone,
  Star,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import {
  engagementApi,
  toApiClientError,
  TALENT_CREDIT_RULES,
  type TalentEngagementSummary,
  type TalentProfile,
} from '@talent-ai/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LevelBadge } from '@/components/candidate-card';
import { formatDate, formatNumber, initials } from '@/lib/format';

export function CandidateDialog({
  profile,
  locked,
  interested = false,
  interestPending = false,
  open,
  onOpenChange,
  onUnlock,
  onToggleInterest,
}: {
  profile: TalentProfile | null;
  locked: boolean;
  interested?: boolean;
  interestPending?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlock: () => void;
  onToggleInterest?: () => void;
}) {
  const [summary, setSummary] = useState<TalentEngagementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profile) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    engagementApi
      .getTalentSummary(profile.id)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(toApiClientError(cause).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, profile]);

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="sr-only">{profile.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Verified talent profile, engagement summary and contact details.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-14 rounded-2xl">
                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-primary/30 to-brand-cyan/20 text-lg font-semibold">
                  {initials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">{profile.name}</p>
                <p className="text-sm text-muted-foreground">{profile.field}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <LevelBadge level={profile.level} />
                  <Badge variant="outline">
                    {formatNumber(profile.experienceYears)} yrs experience
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {onToggleInterest ? (
                <Button
                  variant={interested ? 'secondary' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  disabled={interestPending}
                  onClick={onToggleInterest}
                >
                  {interestPending ? (
                    <Spinner className="size-4" />
                  ) : interested ? (
                    <BookmarkCheck className="size-4" />
                  ) : (
                    <Bookmark className="size-4" />
                  )}
                  {interested ? 'Interested' : 'Mark interested'}
                </Button>
              ) : null}
              {locked ? (
                <Button className="gap-1.5" onClick={onUnlock}>
                  <Crown className="size-4" />
                  Unlock · {TALENT_CREDIT_RULES.TIER3_UNLOCK_COST} TC
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-xl border bg-muted/30 p-3 text-sm sm:grid-cols-2">
            {locked ? (
              <p className="col-span-full flex items-center gap-2 text-xs text-warning">
                <LockKeyhole className="size-3.5" />
                Contact details are hidden until you unlock this Elite Principal profile.
              </p>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4" /> {profile.email}
                </span>
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4" /> {profile.phone}
                </span>
              </>
            )}
          </div>

          {profile.bio ? <p className="text-sm text-muted-foreground">{profile.bio}</p> : null}

          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="font-normal">
                {skill}
              </Badge>
            ))}
          </div>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <GraduationCap className="size-4 text-brand-cyan" /> Education
            </h3>
            {profile.education.length === 0 ? (
              <p className="text-sm text-muted-foreground">No education listed.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {profile.education.map((entry, index) => (
                  <li key={entry.id ?? index} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{entry.college}</p>
                    <p className="text-muted-foreground">
                      {entry.degree} · {entry.branchOfStudy} · Class of {entry.yearOfGraduation}
                      {entry.gpa ? ` · GPA ${entry.gpa}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <BriefcaseBusiness className="size-4 text-brand-cyan" /> Experience
            </h3>
            {profile.previousExperience.length === 0 ? (
              <p className="text-sm text-muted-foreground">No work history listed.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {profile.previousExperience.map((entry, index) => (
                  <li key={entry.id ?? index} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">
                      {entry.role} · {entry.company}
                    </p>
                    <p className="text-muted-foreground">
                      {formatNumber(entry.durationMonths / 12)} yrs
                      {entry.startDate ? ` · since ${formatDate(entry.startDate)}` : ''}
                    </p>
                    {entry.responsibilities.length > 0 ? (
                      <ul className="mt-1.5 list-disc pl-5 text-muted-foreground">
                        {entry.responsibilities.slice(0, 4).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Engagement</h3>
            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground">{error}</p>
            ) : summary ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <div className="rounded-lg border p-2">
                    <ThumbsUp className="mx-auto size-4 text-success" />
                    <p className="mt-1 text-lg font-semibold">{summary.rightSwipes}</p>
                    <p className="text-[11px] text-muted-foreground">Approvals</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <ThumbsDown className="mx-auto size-4 text-destructive" />
                    <p className="mt-1 text-lg font-semibold">{summary.leftSwipes}</p>
                    <p className="text-[11px] text-muted-foreground">Rejections</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <Clock3 className="mx-auto size-4 text-warning" />
                    <p className="mt-1 text-lg font-semibold">{summary.deferredSwipes}</p>
                    <p className="text-[11px] text-muted-foreground">Deferred</p>
                  </div>
                  <div className="rounded-lg border p-2">
                    <Star className="mx-auto size-4 text-warning" />
                    <p className="mt-1 text-lg font-semibold">{summary.totalReviews}</p>
                    <p className="text-[11px] text-muted-foreground">Reviews</p>
                  </div>
                </div>

                {summary.reviews.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {summary.reviews.slice(0, 3).map((review) => (
                      <li key={review.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant={
                              review.decision === 'APPROVE'
                                ? 'default'
                                : review.decision === 'DEFER'
                                  ? 'outline'
                                  : 'destructive'
                            }
                          >
                            {review.decision === 'APPROVE'
                              ? 'Approved'
                              : review.decision === 'DEFER'
                                ? 'Deferred'
                                : 'Rejected'}
                          </Badge>
                          {review.rating ? (
                            <span className="text-xs text-muted-foreground">{review.rating}/5</span>
                          ) : null}
                        </div>
                        {review.feedbackText ? (
                          <p className="mt-1.5 text-muted-foreground">{review.feedbackText}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : loading ? (
              <Spinner />
            ) : (
              <p className="text-sm text-muted-foreground">No engagement yet.</p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

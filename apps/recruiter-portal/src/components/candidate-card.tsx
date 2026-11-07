import {
  BriefcaseBusiness,
  Crown,
  GraduationCap,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react';
import { TALENT_CREDIT_RULES, type TalentProfile } from '@talent-ai/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatNumber, initials, levelLabel } from '@/lib/format';

export function LevelBadge({ level }: { level: TalentProfile['level'] }) {
  if (level === 'LEVEL_3_LEAD') {
    return (
      <Badge className="gap-1 bg-gradient-to-r from-primary to-brand-cyan text-primary-foreground">
        <Crown className="size-3" />
        {levelLabel(level)}
      </Badge>
    );
  }

  return (
    <Badge variant={level === 'LEVEL_2_MID' ? 'outline' : 'secondary'} className="gap-1">
      <Sparkles className="size-3" />
      {levelLabel(level)}
    </Badge>
  );
}

export function CandidateCard({
  profile,
  locked,
  onView,
  onUnlock,
}: {
  profile: TalentProfile;
  locked: boolean;
  onView: () => void;
  onUnlock: () => void;
}) {
  const topSkills = profile.skills.slice(0, 5);
  const remaining = profile.skills.length - topSkills.length;

  return (
    <Card className="glass card-hover h-full justify-between overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-11 rounded-xl">
              <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/30 to-brand-cyan/20 text-sm font-semibold">
                {initials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile.name}</p>
              <p className="truncate text-xs text-muted-foreground">{profile.field}</p>
            </div>
          </div>
          <LevelBadge level={profile.level} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BriefcaseBusiness className="size-3.5" />
            {formatNumber(profile.experienceYears)} yrs experience
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GraduationCap className="size-3.5" />
            {profile.education.length > 0 ? profile.education[0]?.college : 'No education listed'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {topSkills.map((skill) => (
            <Badge key={skill} variant="secondary" className="font-normal">
              {skill}
            </Badge>
          ))}
          {remaining > 0 ? (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              +{remaining}
            </Badge>
          ) : null}
        </div>

        {profile.bio ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{profile.bio}</p>
        ) : null}

        <Separator />

        {locked ? (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            <LockKeyhole className="size-3.5 shrink-0" />
            Contact details unlock with TalentCredits.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" />
              <span className="truncate">{profile.email}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {profile.phone}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {profile.field}
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className={cn('gap-2', locked ? 'flex-col sm:flex-row' : '')}>
        <Button variant={locked ? 'outline' : 'default'} className="flex-1" onClick={onView}>
          View profile
        </Button>
        {locked ? (
          <Button className="flex-1 gap-1.5" onClick={onUnlock}>
            <Crown className="size-4" />
            Unlock · {TALENT_CREDIT_RULES.TIER3_UNLOCK_COST} TC
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

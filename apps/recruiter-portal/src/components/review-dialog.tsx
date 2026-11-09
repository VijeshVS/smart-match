import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, Clock3, Coins, EyeOff, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  TALENT_CREDIT_RULES,
  type BlindTalentProfile,
  type SwipeDecision,
} from '@talent-ai/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Spinner } from '@/components/ui/spinner';
import { formatNumber } from '@/lib/format';

export interface ReviewSubmission {
  rating?: number;
  feedbackText?: string;
  actionableAdvice?: string;
}

export function ReviewDialog({
  profile,
  decision,
  open,
  onOpenChange,
  onSubmit,
}: {
  profile: BlindTalentProfile | null;
  decision: SwipeDecision;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (submission: ReviewSubmission) => Promise<void>;
}) {
  const [rating, setRating] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [actionableAdvice, setActionableAdvice] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setRating('');
      setFeedbackText('');
      setActionableAdvice('');
    }
  }, [open, profile?.id]);

  if (!profile) return null;

  const approved = decision === 'APPROVE';
  const deferred = decision === 'DEFER';
  const hasContent =
    Boolean(rating) || feedbackText.trim().length > 0 || actionableAdvice.trim().length > 0;

  const handleSubmit = async () => {
    setPending(true);
    try {
      await onSubmit({
        ...(rating ? { rating: Number(rating) } : {}),
        ...(feedbackText.trim() ? { feedbackText: feedbackText.trim() } : {}),
        ...(actionableAdvice.trim() ? { actionableAdvice: actionableAdvice.trim() } : {}),
      });
      onOpenChange(false);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'Could not submit the review. Try again.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {approved ? (
              <CircleCheck className="size-5 text-success" />
            ) : deferred ? (
              <Clock3 className="size-5 text-warning" />
            ) : (
              <CircleX className="size-5 text-destructive" />
            )}
            Review {profile.candidateRef}
          </DialogTitle>
          <DialogDescription>
            Blind review — identity and Elite status stay hidden. Submitted feedback earns +
            {TALENT_CREDIT_RULES.REVIEW_FEEDBACK_REWARD} TalentCredits.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <EyeOff className="size-4" />
            </span>
            <div className="min-w-0 text-xs">
              <p className="truncate font-medium">{profile.field}</p>
              <p className="truncate text-muted-foreground">
                {formatNumber(profile.experienceYears)} yrs ·{' '}
                {profile.skills.slice(0, 3).join(' · ') || 'No skills listed'}
              </p>
            </div>
          </div>
          <Badge variant={approved ? 'default' : deferred ? 'outline' : 'destructive'}>
            {approved ? 'Approved' : deferred ? 'Deferred' : 'Rejected'}
          </Badge>
        </div>

        <FieldGroup>
          <Field>
            <FieldLabel>Rating</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              value={rating}
              onValueChange={setRating}
              className="w-full justify-start"
            >
              {['1', '2', '3', '4', '5'].map((value) => (
                <ToggleGroupItem key={value} value={value} aria-label={`${value} out of 5`}>
                  {value}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>1 = poor fit, 5 = exceptional fit.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="review-feedback">Feedback</FieldLabel>
            <Textarea
              id="review-feedback"
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="What stood out in this profile?"
              className="min-h-24 resize-y"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="review-advice">Actionable advice</FieldLabel>
            <Textarea
              id="review-advice"
              value={actionableAdvice}
              onChange={(event) => setActionableAdvice(event.target.value)}
              placeholder="One concrete improvement the candidate can act on."
              className="min-h-20 resize-y"
            />
            <FieldDescription className="inline-flex items-center gap-1.5 text-warning">
              <Coins className="size-3.5" />
              Actionable advice helps the candidate improve and is shared with them.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Skip for now
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={pending || !hasContent}>
            {pending ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
            {pending ? 'Submitting…' : 'Submit review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

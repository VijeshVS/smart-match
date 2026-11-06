import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Building2,
  ChartNoAxesCombined,
  LockKeyhole,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AuthDialog } from './auth-dialog';

const features = [
  {
    icon: BrainCircuit,
    title: 'AI profile intelligence',
    description:
      'Every profile is summarised, scored and enriched with personalised career recommendations.',
  },
  {
    icon: Target,
    title: 'Precision matching',
    description:
      'Recruiters discover you through semantic talent search instead of keyword roulette.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Live career signals',
    description:
      'Track approvals, rejections and recruiter feedback in a single real-time dashboard.',
  },
];

const highlights = [
  { value: '3x', label: 'faster shortlisting' },
  { value: '92%', label: 'match relevance' },
  { value: '12k+', label: 'verified talent profiles' },
];

export function Landing() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden px-4 pt-16 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col items-start gap-7">
            <Badge variant="outline" className="gap-2 border-primary/30 bg-primary/10 px-3 py-1">
              <Sparkles className="text-primary" />
              Your career, supercharged by talent.ai
            </Badge>

            <div className="flex flex-col gap-5">
              <h1 className="font-heading text-5xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
                Find your
                <br />
                <span className="gradient-text">perfect match</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                Build a verified talent profile, let our matching engine surface the right
                opportunities, and grow with AI-guided career intelligence.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" className="px-5" onClick={() => setAuthOpen(true)}>
                Create your profile
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-5"
                onClick={() => setAuthOpen(true)}
              >
                I already have an account
              </Button>
            </div>

            <Separator className="my-2 max-w-xl" />

            <dl className="grid w-full max-w-xl grid-cols-3 gap-4">
              {highlights.map((item) => (
                <div key={item.label} className="flex flex-col gap-1">
                  <dt className="font-heading text-2xl font-bold text-foreground">{item.value}</dt>
                  <dd className="text-xs text-muted-foreground sm:text-sm">{item.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/25 via-brand/10 to-brand-cyan/20 blur-3xl" />
            <Card className="glass-strong border-white/10 bg-card/70 shadow-2xl">
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-brand-cyan text-white">
                      <Zap className="size-5" />
                    </span>
                    <div>
                      <CardTitle className="text-base">Match snapshot</CardTitle>
                      <CardDescription>Updated moments ago</CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-success/15 text-success" variant="secondary">
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Building2 className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">Staff Frontend Engineer</p>
                      <p className="text-xs text-muted-foreground">Northwind Labs · Remote</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-success/30 text-success">
                    96% fit
                  </Badge>
                </div>

                <div className="flex flex-col gap-3">
                  {[
                    { icon: BadgeCheck, label: 'Verified talent tier', value: 'Elite Principal' },
                    { icon: BrainCircuit, label: 'AI career signal', value: 'Strong upward trajectory' },
                    { icon: LockKeyhole, label: 'Profile visibility', value: 'Recruiter verified' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="text-muted-foreground">{label}</span>
                      <span className="ml-auto font-medium">{value}</span>
                    </div>
                  ))}
                </div>

                <Button className="w-full" variant="secondary" onClick={() => setAuthOpen(true)}>
                  Unlock your dashboard
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex max-w-2xl flex-col gap-3">
            <Badge variant="outline" className="w-fit border-brand-cyan/30 text-brand-cyan">
              Built for candidates
            </Badge>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to be discovered
            </h2>
            <p className="text-muted-foreground">
              One profile, one dashboard, and an intelligence layer that keeps working for you.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="card-hover border-white/10 bg-card/60">
                <CardHeader>
                  <span className="mb-2 inline-flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-brand-cyan/15 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Card className="glass-strong overflow-hidden border-white/10">
            <CardContent className="flex flex-col items-start justify-between gap-6 py-4 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-2xl font-bold">Ready to meet your next role?</h2>
                <p className="text-muted-foreground">
                  Join talent.ai and let the matching engine do the heavy lifting.
                </p>
              </div>
              <Button size="lg" className="px-5" onClick={() => setAuthOpen(true)}>
                Get started free
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}

export default Landing;

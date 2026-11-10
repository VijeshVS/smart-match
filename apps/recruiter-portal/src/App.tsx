import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { BrandWordmark } from '@/components/brand';
import { AppShell } from '@/components/app-shell';
import { AuthPage } from '@/components/auth-page';
import { OrgSetup } from '@/components/org-setup';
import { DashboardPage } from '@/pages/dashboard';
import { CandidatesPage } from '@/pages/candidates';
import { TalentSwipePage } from '@/pages/talent-swipe';
import { TalentLensPage } from '@/pages/talent-lens';
import { RewardsPage } from '@/pages/rewards';
import { useAuth } from '@/lib/auth';
import { WalletProvider } from '@/lib/wallet';

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="mesh-bg" aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Splash({ label = 'Restoring your hiring workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <BrandWordmark subtitle="Recruiter" />
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        {label}
      </div>
    </div>
  );
}

function CenteredCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="glass-strong w-full max-w-md border-white/10">
        <CardHeader className="items-start gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
            {icon}
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">{children}</CardContent>
      </Card>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="gradient-text font-heading text-6xl font-extrabold">404</p>
      <h1 className="text-xl font-semibold">This page left the talent pool</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you were looking for doesn’t exist. Head back to your dashboard to keep hiring.
      </p>
      <Button asChild>
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}

function App() {
  const { ready, snapshot, isRecruiter, orgStatus, orgError, reloadOrg, signOut } = useAuth();
  if (!ready) {
    return (
      <Backdrop>
        <Splash />
      </Backdrop>
    );
  }

  if (!snapshot.user) {
    return (
      <Backdrop>
        <AuthPage />
      </Backdrop>
    );
  }

  if (!isRecruiter) {
    return (
      <Backdrop>
        <CenteredCard
          icon={<ShieldAlert className="size-5" />}
          title="Recruiter access only"
          description="This workspace is reserved for recruiter and admin accounts. Sign in with a recruiter account to continue."
        >
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>
        </CenteredCard>
      </Backdrop>
    );
  }

  if (orgStatus === 'idle' || orgStatus === 'loading') {
    return (
      <Backdrop>
        <Splash label="Loading your workspace…" />
      </Backdrop>
    );
  }

  if (orgStatus === 'missing') {
    return (
      <Backdrop>
        <OrgSetup />
      </Backdrop>
    );
  }

  if (orgStatus === 'error') {
    return (
      <Backdrop>
        <CenteredCard
          icon={<ShieldAlert className="size-5" />}
          title="We couldn’t load your workspace"
          description={orgError ?? 'The recruiter service did not respond. Try again in a moment.'}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void reloadOrg()}>
              <RefreshCw data-icon="inline-start" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut data-icon="inline-start" />
              Sign out
            </Button>
          </div>
        </CenteredCard>
      </Backdrop>
    );
  }

  return (
    <Backdrop>
      <WalletProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="candidates" element={<CandidatesPage />} />
            <Route path="swipe" element={<TalentSwipePage />} />
            <Route path="lens" element={<TalentLensPage />} />
            <Route path="rewards" element={<RewardsPage />} />
            <Route path="jumble" element={<Navigate to="/swipe" replace />} />
            <Route path="filter" element={<Navigate to="/candidates" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </WalletProvider>
    </Backdrop>
  );
}

export default App;

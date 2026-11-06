import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Coins,
  LockKeyhole,
  Mail,
  ScanSearch,
  ShieldCheck,
  Shuffle,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  authApi,
  recruiterApi,
  toApiClientError,
  type AuthSession,
} from '@talent-ai/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandMark } from '@/components/brand';
import { appConfig } from '@/config';
import { useAuth } from '@/lib/auth';

const FEATURES = [
  {
    icon: Shuffle,
    title: 'TalentSwipe',
    description: 'High-signal decisions in seconds, with structured feedback that earns credits.',
  },
  {
    icon: ScanSearch,
    title: 'TalentLens',
    description: 'Describe the hire you need and get ranked, explainable matches.',
  },
  {
    icon: Coins,
    title: 'TalentCredits',
    description: 'Unlock Elite Principal profiles with credits earned from great feedback.',
  },
];

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{12,128}$/;

export function AuthPage() {
  const navigate = useNavigate();
  const { setOrg } = useAuth();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [title, setTitle] = useState('');

  const resetErrors = () => {
    setError(null);
    setFieldError(null);
  };

  const ensureRecruiter = (session: AuthSession) => {
    if (session.user.role !== 'RECRUITER' && session.user.role !== 'ADMIN') {
      throw new Error('ROLE_MISMATCH');
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetErrors();
    setPending(true);

    try {
      const session = await authApi.login({ email: email.trim(), password });
      ensureRecruiter(session);
      toast.success(`Welcome back, ${session.user.fullName.split(' ')[0]}`);
      navigate('/', { replace: true });
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'ROLE_MISMATCH') {
        await authApi.logout();
        setError(
          `This account is a candidate account. Continue in the candidate portal at ${appConfig.candidatePortalUrl}.`,
        );
      } else {
        setError(toApiClientError(cause).message);
      }
    } finally {
      setPending(false);
    }
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetErrors();

    if (!PASSWORD_RULE.test(password)) {
      setFieldError('Use at least 12 characters with one letter and one number.');
      return;
    }

    setPending(true);

    try {
      const session = await authApi.register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role: 'RECRUITER',
      });
      ensureRecruiter(session);

      const context = await recruiterApi.upsertProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        organizationName: organizationName.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
      });

      setOrg(context);
      toast.success(`Workspace created for ${context.organization.name}`);
      navigate('/', { replace: true });
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'ROLE_MISMATCH') {
        await authApi.logout();
        setError('That email is already registered as a candidate.');
        setTab('login');
      } else {
        setError(toApiClientError(cause).message);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mesh-bg" aria-hidden="true" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-12 px-5 py-12 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:px-10">
        <section className="flex flex-col gap-10">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="font-heading text-xl font-bold tracking-tight">
                talent<span className="text-primary">.</span>ai
              </p>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Recruiter workspace
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5 text-brand-cyan" />
              AI-assisted hiring, verified talent tiers
            </span>
            <h1 className="font-heading text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
              Hire the top 1%,
              <br />
              <span className="gradient-text">not the loudest 1%.</span>
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
              Review verified candidates with swipe-speed workflows, semantic search and an
              explainable match score. Every review makes the talent graph sharper.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, title: featureTitle, description }) => (
              <li
                key={featureTitle}
                className="flex items-start gap-3 rounded-xl border bg-card/40 p-3.5 backdrop-blur"
              >
                <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{featureTitle}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-success" /> JWT + role-scoped access
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success" /> Verified talent only
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LockKeyhole className="size-3.5 text-brand-cyan" /> Level-3 gated by credits
            </span>
          </div>
        </section>

        <Card className="w-full border-white/10 bg-card/70 shadow-2xl shadow-black/40 backdrop-blur-2xl">
          <CardHeader className="gap-1.5">
            <CardTitle className="text-xl">Access your workspace</CardTitle>
            <CardDescription>
              Sign in with a recruiter account, or create an organization in under a minute.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={tab}
              onValueChange={(value) => {
                setTab(value as 'login' | 'register');
                resetErrors();
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="register">Create account</TabsTrigger>
              </TabsList>

              {error ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle />
                  <AlertTitle>Authentication failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <TabsContent value="login" className="mt-4">
                <form onSubmit={handleLogin}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="login-email">Work email</FieldLabel>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="login-password">Password</FieldLabel>
                      <Input
                        id="login-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                    </Field>
                    <Button type="submit" className="w-full" disabled={pending}>
                      {pending ? <Spinner data-icon="inline-start" /> : <ArrowRight data-icon="inline-end" />}
                      {pending ? 'Signing in…' : 'Continue to dashboard'}
                    </Button>
                  </FieldGroup>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-4">
                <form onSubmit={handleRegister}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="register-name">Full name</FieldLabel>
                      <Input
                        id="register-name"
                        autoComplete="name"
                        placeholder="Aditi Rao"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        required
                        minLength={2}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="register-org">Organization</FieldLabel>
                      <Input
                        id="register-org"
                        autoComplete="organization"
                        placeholder="Northstar Labs"
                        value={organizationName}
                        onChange={(event) => setOrganizationName(event.target.value)}
                        required
                        minLength={2}
                      />
                      <FieldDescription>
                        This becomes your workspace and billing identity.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="register-title">
                        Your role <span className="text-muted-foreground">(optional)</span>
                      </FieldLabel>
                      <Input
                        id="register-title"
                        placeholder="Technical recruiter"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="register-email">Work email</FieldLabel>
                      <Input
                        id="register-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </Field>
                    <Field data-invalid={Boolean(fieldError)}>
                      <FieldLabel htmlFor="register-password">Password</FieldLabel>
                      <Input
                        id="register-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="At least 12 characters"
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          if (fieldError) setFieldError(null);
                        }}
                        aria-invalid={Boolean(fieldError)}
                        required
                      />
                      {fieldError ? (
                        <FieldError>{fieldError}</FieldError>
                      ) : (
                        <FieldDescription>
                          12+ characters with at least one letter and one number.
                        </FieldDescription>
                      )}
                    </Field>
                    <Button type="submit" className="w-full" disabled={pending}>
                      {pending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <Building2 data-icon="inline-start" />
                      )}
                      {pending ? 'Creating workspace…' : 'Create recruiter workspace'}
                    </Button>
                  </FieldGroup>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2 border-t text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" /> Candidate? Use the candidate portal instead.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3.5" /> Admin accounts can sign in here too.
            </span>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

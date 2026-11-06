import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, toApiClientError } from '@talent-ai/api-client';
import { AlertCircle, LockKeyhole, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'login' | 'register';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: Mode;
}

function validatePassword(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Password must include a letter.';
  if (!/\d/.test(password)) return 'Password must include a number.';
  return null;
}

export function AuthDialog({ open, onOpenChange, defaultMode = 'login' }: AuthDialogProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError('');
      setFieldErrors({});
    }
    onOpenChange(next);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setLoading(true);

    try {
      await authApi.login({ email: loginEmail, password: loginPassword });
      onOpenChange(false);
      navigate('/dashboard');
    } catch (cause) {
      const apiError = toApiClientError(cause);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const errors: Record<string, string> = {};
    const passwordError = validatePassword(registerPassword);
    if (passwordError) errors.password = passwordError;
    if (registerPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await authApi.register({
        fullName,
        email: registerEmail,
        password: registerPassword,
        role: 'CANDIDATE',
      });
      onOpenChange(false);
      navigate('/register');
    } catch (cause) {
      setError(toApiClientError(cause).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to talent.ai</DialogTitle>
          <DialogDescription>
            Sign in to your candidate workspace or create an account to get matched.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="register">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="flex flex-col gap-4 pt-2">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="login-email">Email address</FieldLabel>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="pl-9"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      required
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="login-password">Password</FieldLabel>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      className="pl-9"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      required
                    />
                  </div>
                </Field>
              </FieldGroup>

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Unable to sign in</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? <Spinner data-icon="inline-start" /> : null}
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="flex flex-col gap-4 pt-2">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="register-name">Full name</FieldLabel>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="register-name"
                      autoComplete="name"
                      placeholder="Ada Lovelace"
                      className="pl-9"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="register-email">Email address</FieldLabel>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="pl-9"
                      value={registerEmail}
                      onChange={(event) => setRegisterEmail(event.target.value)}
                      required
                    />
                  </div>
                </Field>
                <Field data-invalid={Boolean(fieldErrors.password)}>
                  <FieldLabel htmlFor="register-password">Password</FieldLabel>
                  <Input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    At least 12 characters, including a letter and a number.
                  </p>
                  <FieldError>{fieldErrors.password}</FieldError>
                </Field>
                <Field data-invalid={Boolean(fieldErrors.confirmPassword)}>
                  <FieldLabel htmlFor="register-confirm">Confirm password</FieldLabel>
                  <Input
                    id="register-confirm"
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                  <FieldError>{fieldErrors.confirmPassword}</FieldError>
                </Field>
              </FieldGroup>

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Unable to create your account</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? <Spinner data-icon="inline-start" /> : null}
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

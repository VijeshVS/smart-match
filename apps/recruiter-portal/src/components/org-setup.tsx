import { useState, type FormEvent } from 'react';
import { Building2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { recruiterApi, toApiClientError } from '@talent-ai/api-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { BrandMark } from '@/components/brand';
import { useAuth } from '@/lib/auth';

/**
 * Shown when a recruiter identity exists in auth-service but no organization
 * profile has been created yet (for example, seeded or legacy accounts).
 */
export function OrgSetup() {
  const { snapshot, setOrg, signOut } = useAuth();
  const [organizationName, setOrganizationName] = useState('');
  const [fullName, setFullName] = useState(snapshot.user?.fullName ?? '');
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!snapshot.user) return;

    setPending(true);
    setError(null);

    try {
      const context = await recruiterApi.upsertProfile({
        fullName: fullName.trim(),
        email: snapshot.user.email,
        organizationName: organizationName.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
      });
      setOrg(context);
      toast.success(`Welcome to ${context.organization.name}`);
    } catch (cause) {
      setError(toApiClientError(cause).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="mesh-bg" aria-hidden="true" />
      <Card className="relative z-10 w-full max-w-lg border-white/10 bg-card/70 backdrop-blur-2xl">
        <CardHeader className="gap-2">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="font-heading text-lg font-bold">
                talent<span className="text-primary">.</span>ai
              </p>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Finish setup
              </p>
            </div>
          </div>
          <CardTitle className="mt-2 text-xl">Create your organization</CardTitle>
          <CardDescription>
            Your recruiter account is ready. Add the organization so jobs, reviews and
            TalentCredits are scoped correctly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
                <Input
                  id="org-name"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Northstar Labs"
                  required
                  minLength={2}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-full-name">Your full name</FieldLabel>
                <Input
                  id="org-full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  minLength={2}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-title">Title</FieldLabel>
                <Input
                  id="org-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Head of Talent"
                />
                <FieldDescription>Optional, shown on your reviews.</FieldDescription>
              </Field>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : <Building2 data-icon="inline-start" />}
                {pending ? 'Creating workspace…' : 'Create workspace'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => void signOut()}
              >
                <LogOut data-icon="inline-start" />
                Sign out
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

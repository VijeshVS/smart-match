import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  GraduationCap,
  Plus,
  Rocket,
  User,
  X,
} from 'lucide-react';
import { talentApi, toApiClientError } from '@talent-ai/api-client';
import type { CreateTalentProfileRequest } from '@talent-ai/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth';

const PREDEFINED_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Python',
  'C++',
  'Go',
  'Rust',
  'AWS',
  'Docker',
  'Kubernetes',
  'GraphQL',
  'SQL',
  'MongoDB',
  'Redis',
  'Git',
  'CI/CD',
  'Machine Learning',
  'Data Science',
  'DevOps',
  'Cloud Computing',
  'System Design',
  'Microservices',
  'Testing',
];

const STEPS = [
  { label: 'Personal', icon: User },
  { label: 'Education', icon: GraduationCap },
  { label: 'Experience', icon: Briefcase },
];

interface EducationForm {
  college: string;
  degree: string;
  branchOfStudy: string;
  yearOfGraduation: number;
  gpa: number;
}

interface ExperienceForm {
  company: string;
  role: string;
  durationMonths: number;
  responsibilities: string;
}

const emptyEducation = (): EducationForm => ({
  college: '',
  degree: '',
  branchOfStudy: '',
  yearOfGraduation: new Date().getFullYear(),
  gpa: 0,
});

const emptyExperience = (): ExperienceForm => ({
  company: '',
  role: '',
  durationMonths: 12,
  responsibilities: '',
});

export function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [field, setField] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [skills, setSkills] = useState<string[]>([]);
  const [education, setEducation] = useState<EducationForm[]>([emptyEducation()]);
  const [experience, setExperience] = useState<ExperienceForm[]>([emptyExperience()]);

  const updateEducation = (index: number, patch: Partial<EducationForm>) => {
    setEducation((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updateExperience = (index: number, patch: Partial<ExperienceForm>) => {
    setExperience((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Your full name is required.';
    if (!phone.trim()) return 'A phone number is required.';
    if (!field.trim()) return 'Tell us your field of work.';
    if (skills.length === 0) return 'Select at least one skill.';
    if (education.some((item) => !item.college.trim() || !item.degree.trim())) {
      return 'Complete the institution and degree for each education entry.';
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSubmitting(true);

    const payload: CreateTalentProfileRequest = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      field: field.trim(),
      skills,
      experienceYears,
      education: education.map((item) => ({
        college: item.college.trim(),
        degree: item.degree.trim(),
        branchOfStudy: item.branchOfStudy.trim(),
        yearOfGraduation: item.yearOfGraduation,
        gpa: item.gpa || undefined,
      })),
      previousExperience: experience.map((item) => ({
        company: item.company.trim(),
        role: item.role.trim(),
        durationMonths: item.durationMonths,
        responsibilities: item.responsibilities
          .split(/[\n,]/)
          .map((value) => value.trim())
          .filter(Boolean),
      })),
    };

    try {
      try {
        await talentApi.createProfile(payload);
      } catch (cause) {
        const apiError = toApiClientError(cause);
        if (apiError.status === 409) {
          const existing = await talentApi.getMyProfile();
          await talentApi.updateProfile(existing.id, payload);
        } else {
          throw cause;
        }
      }

      setSubmitted(true);
    } catch (cause) {
      setError(toApiClientError(cause).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <Card className="glass-strong w-full max-w-md text-center">
          <CardContent className="flex flex-col items-center gap-5 py-4">
            <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand-cyan text-white shadow-lg shadow-primary/30">
              <Check className="size-8" />
            </span>
            <div className="flex flex-col gap-2">
              <h2 className="font-heading text-2xl font-bold">Profile created</h2>
              <p className="text-sm text-muted-foreground">
                Your talent profile is live. Our matching engine is already indexing it.
              </p>
            </div>
            <Button className="w-full" size="lg" onClick={() => navigate('/dashboard')}>
              Go to dashboard
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <Badge variant="outline" className="border-primary/30 text-primary">
          Candidate onboarding
        </Badge>
        <h1 className="font-heading text-4xl font-extrabold tracking-tight">
          Create your <span className="gradient-text">talent profile</span>
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Three quick steps stand between you and AI-matched opportunities.
        </p>
      </div>

      <Card className="glass-strong mb-6">
        <CardContent className="flex flex-col gap-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {STEPS.map(({ label, icon: Icon }, index) => {
              const isActive = step === index;
              const isComplete = step > index;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/15 text-foreground'
                      : isComplete
                        ? 'text-success'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  }`}
                >
                  {isComplete ? <Check className="size-4" /> : <Icon className="size-4" />}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{index + 1}</span>
                </button>
              );
            })}
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} />
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle>{STEPS[step]?.label} details</CardTitle>
            <CardDescription>
              {step === 0
                ? 'Tell recruiters who you are and what you work with.'
                : step === 1
                  ? 'Add the education that backs your expertise.'
                  : 'Showcase the work that made you who you are.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-8">
            {step === 0 ? (
              <>
                <FieldGroup className="grid gap-5 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="onboard-name">Full name</FieldLabel>
                    <Input
                      id="onboard-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Ada Lovelace"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="onboard-email">Email</FieldLabel>
                    <Input
                      id="onboard-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="onboard-phone">Phone</FieldLabel>
                    <Input
                      id="onboard-phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+1 (555) 000-0000"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="onboard-field">Field of work</FieldLabel>
                    <Input
                      id="onboard-field"
                      value={field}
                      onChange={(event) => setField(event.target.value)}
                      placeholder="Software development"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="onboard-years">Years of experience</FieldLabel>
                    <Input
                      id="onboard-years"
                      type="number"
                      min={0}
                      max={60}
                      value={experienceYears}
                      onChange={(event) => setExperienceYears(Number(event.target.value))}
                    />
                  </Field>
                </FieldGroup>

                <Separator />

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Technical skills</h3>
                    <Badge variant="secondary">{skills.length} selected</Badge>
                  </div>
                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    value={skills}
                    onValueChange={setSkills}
                    className="flex flex-wrap justify-start gap-2"
                  >
                    {PREDEFINED_SKILLS.map((skill) => (
                      <ToggleGroupItem key={skill} value={skill} className="rounded-full px-3">
                        {skill}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <div className="flex flex-col gap-5">
                {education.map((item, index) => (
                  <Card key={index} className="border-white/10 bg-white/[0.02]">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">Education {index + 1}</CardTitle>
                        {education.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setEducation((items) => items.filter((_, i) => i !== index))
                            }
                          >
                            <X />
                            <span className="sr-only">Remove education</span>
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup className="grid gap-5 md:grid-cols-2">
                        <Field>
                          <FieldLabel>Institution</FieldLabel>
                          <Input
                            value={item.college}
                            onChange={(event) =>
                              updateEducation(index, { college: event.target.value })
                            }
                            placeholder="University name"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Degree</FieldLabel>
                          <Input
                            value={item.degree}
                            onChange={(event) =>
                              updateEducation(index, { degree: event.target.value })
                            }
                            placeholder="Bachelor of Science"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Branch of study</FieldLabel>
                          <Input
                            value={item.branchOfStudy}
                            onChange={(event) =>
                              updateEducation(index, { branchOfStudy: event.target.value })
                            }
                            placeholder="Computer Science"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Graduation year</FieldLabel>
                          <Input
                            type="number"
                            min={1950}
                            max={2100}
                            value={item.yearOfGraduation}
                            onChange={(event) =>
                              updateEducation(index, {
                                yearOfGraduation: Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel>GPA</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            step={0.01}
                            value={item.gpa}
                            onChange={(event) =>
                              updateEducation(index, { gpa: Number(event.target.value) })
                            }
                          />
                        </Field>
                      </FieldGroup>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEducation((items) => [...items, emptyEducation()])}
                >
                  <Plus data-icon="inline-start" />
                  Add education
                </Button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="flex flex-col gap-5">
                {experience.map((item, index) => (
                  <Card key={index} className="border-white/10 bg-white/[0.02]">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">Experience {index + 1}</CardTitle>
                        {experience.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              setExperience((items) => items.filter((_, i) => i !== index))
                            }
                          >
                            <X />
                            <span className="sr-only">Remove experience</span>
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <FieldGroup className="grid gap-5 md:grid-cols-2">
                        <Field>
                          <FieldLabel>Company</FieldLabel>
                          <Input
                            value={item.company}
                            onChange={(event) =>
                              updateExperience(index, { company: event.target.value })
                            }
                            placeholder="Company name"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Role</FieldLabel>
                          <Input
                            value={item.role}
                            onChange={(event) =>
                              updateExperience(index, { role: event.target.value })
                            }
                            placeholder="Senior Engineer"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Duration (months)</FieldLabel>
                          <Input
                            type="number"
                            min={0}
                            max={1200}
                            value={item.durationMonths}
                            onChange={(event) =>
                              updateExperience(index, {
                                durationMonths: Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field className="md:col-span-2">
                          <FieldLabel>Key responsibilities</FieldLabel>
                          <Textarea
                            value={item.responsibilities}
                            onChange={(event) =>
                              updateExperience(index, { responsibilities: event.target.value })
                            }
                            placeholder="Comma or newline separated responsibilities"
                            rows={4}
                          />
                        </Field>
                      </FieldGroup>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setExperience((items) => [...items, emptyExperience()])}
                >
                  <Plus data-icon="inline-start" />
                  Add experience
                </Button>
              </div>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>We couldn’t save your profile</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
          >
            <ArrowLeft data-icon="inline-start" />
            Previous
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((value) => value + 1)}>
              Next step
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner data-icon="inline-start" /> : <Rocket data-icon="inline-start" />}
              {submitting ? 'Submitting…' : 'Submit profile'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

export default Onboarding;

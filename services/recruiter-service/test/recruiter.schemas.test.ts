import { describe, expect, it } from 'vitest';
import {
  createJobPostingSchema,
  jobQuerySchema,
  upsertRecruiterProfileSchema,
} from '../src/validation/recruiter.schemas.js';

describe('recruiter validation', () => {
  it('accepts a complete recruiter profile', () => {
    const parsed = upsertRecruiterProfileSchema.parse({
      fullName: ' Riley Recruiter ',
      email: 'riley@acme.com',
      organizationName: 'Acme',
      title: 'Head of Talent',
      phone: '+49 30 123456',
      website: 'https://acme.com',
    });

    expect(parsed.fullName).toBe('Riley Recruiter');
    expect(parsed.website).toBe('https://acme.com');
  });

  it('treats a blank optional website as absent', () => {
    const parsed = upsertRecruiterProfileSchema.parse({
      fullName: 'Riley Recruiter',
      email: 'riley@acme.com',
      organizationName: 'Acme',
      website: '   ',
    });

    expect(parsed.website).toBeUndefined();
  });

  it('rejects an invalid website and malformed email', () => {
    expect(() =>
      upsertRecruiterProfileSchema.parse({
        fullName: 'Riley Recruiter',
        email: 'not-an-email',
        organizationName: 'Acme',
        website: 'not a url',
      }),
    ).toThrow();
  });

  it('applies job posting defaults and normalizes integers', () => {
    const parsed = createJobPostingSchema.parse({
      title: 'Staff Engineer',
      description: 'Build the talent platform.',
      requiredSkills: ['TypeScript', 'PostgreSQL'],
      minExperienceYears: '6',
    });

    expect(parsed.employmentType).toBe('FULL_TIME');
    expect(parsed.status).toBe('OPEN');
    expect(parsed.minExperienceYears).toBe(6);
  });

  it('rejects inverted experience ranges', () => {
    expect(() =>
      createJobPostingSchema.parse({
        title: 'Staff Engineer',
        description: 'Build the talent platform.',
        requiredSkills: ['TypeScript'],
        minExperienceYears: 10,
        maxExperienceYears: 2,
      }),
    ).toThrow(/minExperienceYears/);
  });

  it('parses comma-separated skill filters', () => {
    const parsed = jobQuerySchema.parse({
      page: '2',
      limit: '10',
      skills: 'TypeScript, PostgreSQL',
      status: 'OPEN',
    });

    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.skills).toEqual(['TypeScript', 'PostgreSQL']);
    expect(parsed.status).toBe('OPEN');
  });

  it('rejects a non-UUID organization filter', () => {
    expect(() => jobQuerySchema.parse({ organizationId: 'acme' })).toThrow();
  });
});

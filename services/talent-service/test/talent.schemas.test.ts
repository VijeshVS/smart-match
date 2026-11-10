import { describe, expect, it } from 'vitest';
import {
  blindTalentQuerySchema,
  createTalentProfileSchema,
  talentQuerySchema,
  updateTalentProfileSchema,
} from '../src/validation/talent.schemas.js';

const validProfile = {
  name: 'Neha Chatterjee',
  email: 'neha@example.com',
  phone: '+91-9123456780',
  field: 'DevOps Engineer',
  skills: ['Docker', 'Kubernetes'],
  experienceYears: 4,
};

describe('createTalentProfileSchema', () => {
  it('accepts a minimal valid profile', () => {
    const parsed = createTalentProfileSchema.parse(validProfile);
    expect(parsed.email).toBe('neha@example.com');
    expect(parsed.education).toBeUndefined();
  });

  it('rejects an invalid email and empty skills', () => {
    const result = createTalentProfileSchema.safeParse({
      ...validProfile,
      email: 'not-an-email',
      skills: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid talent level', () => {
    const result = createTalentProfileSchema.safeParse({
      ...validProfile,
      level: 'LEVEL_9',
    });
    expect(result.success).toBe(false);
  });

  it('treats empty optional URLs as absent', () => {
    const parsed = createTalentProfileSchema.parse({
      ...validProfile,
      portfolioUrl: '',
      linkedinUrl: '   ',
    });
    expect(parsed.portfolioUrl).toBeUndefined();
    expect(parsed.linkedinUrl).toBeUndefined();
  });

  it('validates nested education and experience records', () => {
    const parsed = createTalentProfileSchema.parse({
      ...validProfile,
      education: [
        {
          college: 'MIT Academy of Engineering',
          degree: 'B.E.',
          branchOfStudy: 'Information Technology',
          yearOfGraduation: 2021,
          gpa: 8.2,
        },
      ],
      previousExperience: [
        {
          company: 'Zensar',
          role: 'Junior DevOps Engineer',
          durationMonths: 24,
          responsibilities: ['Managed CI/CD pipelines'],
        },
      ],
    });

    expect(parsed.education?.[0]?.gpa).toBe(8.2);
    expect(parsed.previousExperience?.[0]?.durationMonths).toBe(24);
  });
});

describe('updateTalentProfileSchema', () => {
  it('requires at least one field', () => {
    expect(updateTalentProfileSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a partial update', () => {
    const parsed = updateTalentProfileSchema.parse({ bio: 'Backend engineer' });
    expect(parsed).toEqual({ bio: 'Backend engineer' });
  });
});

describe('talentQuerySchema', () => {
  it('applies pagination defaults and coerces numbers', () => {
    const parsed = talentQuerySchema.parse({ page: '2', limit: '5' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(5);
  });

  it('accepts comma-separated and repeated skill parameters', () => {
    const parsed = talentQuerySchema.parse({ skills: 'Docker, AWS' });
    expect(parsed.skills).toEqual(['Docker', 'AWS']);

    const repeated = talentQuerySchema.parse({ skills: ['Docker', 'AWS,Kubernetes'] });
    expect(repeated.skills).toEqual(['Docker', 'AWS', 'Kubernetes']);
  });

  it('drops an empty skills parameter', () => {
    expect(talentQuerySchema.parse({ skills: ' , ' }).skills).toBeUndefined();
  });

  it('accepts comma-separated pipeline talent ids and preserves an empty scope', () => {
    const parsed = talentQuerySchema.parse({
      talentIds: '99999999-9999-4999-8999-999999999999,88888888-8888-4888-8888-888888888888',
    });
    expect(parsed.talentIds).toEqual([
      '99999999-9999-4999-8999-999999999999',
      '88888888-8888-4888-8888-888888888888',
    ]);

    expect(
      talentQuerySchema.parse({ talentIds: ['99999999-9999-4999-8999-999999999999'] }).talentIds,
    ).toEqual(['99999999-9999-4999-8999-999999999999']);
    expect(talentQuerySchema.parse({ talentIds: '' }).talentIds).toEqual([]);
    expect(talentQuerySchema.parse({}).talentIds).toBeUndefined();
  });

  it('rejects non-UUID pipeline talent ids', () => {
    expect(talentQuerySchema.safeParse({ talentIds: 'talent-1' }).success).toBe(false);
  });

  it('rejects an inverted experience range', () => {
    const result = talentQuerySchema.safeParse({
      minExperienceYears: '10',
      maxExperienceYears: '2',
    });
    expect(result.success).toBe(false);
  });

  it('caps the page size at 100', () => {
    expect(talentQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});

describe('blindTalentQuerySchema', () => {
  it('applies the same pagination, skill and experience parsing', () => {
    const parsed = blindTalentQuerySchema.parse({
      page: '2',
      skills: 'Docker, AWS',
      minExperienceYears: '3',
    });

    expect(parsed.page).toBe(2);
    expect(parsed.skills).toEqual(['Docker', 'AWS']);
    expect(parsed.minExperienceYears).toBe(3);
  });

  it('drops tier filtering so Elite status cannot be probed', () => {
    expect(blindTalentQuerySchema.parse({ level: 'LEVEL_3_LEAD' })).not.toHaveProperty('level');
  });
});

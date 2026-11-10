import { describe, expect, it } from 'vitest';
import { hasTalentQualificationChanges, type TalentProfile } from '@talent-ai/shared-types';
import {
  blindCandidateRef,
  buildBlindTalentFilter,
  buildPaginationMeta,
  buildTalentFilter,
  caseInsensitiveExact,
  deriveTalentLevel,
  escapeRegex,
  normalizeSkills,
  toBlindTalentProfile,
} from '../src/domain/talent.js';

describe('deriveTalentLevel', () => {
  it('maps entry-level experience to Junior Fellow', () => {
    expect(deriveTalentLevel(0)).toBe('LEVEL_1_ENTRY');
    expect(deriveTalentLevel(2.9)).toBe('LEVEL_1_ENTRY');
  });

  it('maps mid-level experience to Pro Engineer', () => {
    expect(deriveTalentLevel(3)).toBe('LEVEL_2_MID');
    expect(deriveTalentLevel(7.9)).toBe('LEVEL_2_MID');
  });

  it('maps lead-level experience to Elite Principal', () => {
    expect(deriveTalentLevel(8)).toBe('LEVEL_3_LEAD');
    expect(deriveTalentLevel(20)).toBe('LEVEL_3_LEAD');
  });
});

describe('normalizeSkills', () => {
  it('trims, collapses whitespace and removes blanks', () => {
    expect(normalizeSkills(['  Docker ', 'Amazon   Web Services', ''])).toEqual([
      'Docker',
      'Amazon Web Services',
    ]);
  });

  it('de-duplicates case-insensitively and keeps the first casing', () => {
    expect(normalizeSkills(['Docker', 'docker', 'DOCKER', 'Kubernetes'])).toEqual([
      'Docker',
      'Kubernetes',
    ]);
  });
});

describe('regex helpers', () => {
  it('escapes regular-expression metacharacters', () => {
    expect(escapeRegex('C++ / (Node.js).*')).toBe('C\\+\\+ / \\(Node\\.js\\)\\.\\*');
  });

  it('builds anchored case-insensitive patterns', () => {
    const pattern = caseInsensitiveExact('DevOps');
    expect(pattern.test('devops')).toBe(true);
    expect(pattern.test('devops engineer')).toBe(false);
  });
});

describe('buildTalentFilter', () => {
  it('returns an empty filter for an unfiltered query', () => {
    expect(buildTalentFilter({})).toEqual({});
  });

  it('requires every requested skill with $all', () => {
    const filter = buildTalentFilter({ skills: ['Docker', 'AWS'] });
    expect(filter.skills).toEqual({ $all: [/^Docker$/i, /^AWS$/i] });
  });

  it('combines experience bounds, level and field', () => {
    const filter = buildTalentFilter({
      level: 'LEVEL_2_MID',
      field: 'DevOps Engineer',
      minExperienceYears: 3,
      maxExperienceYears: 8,
    });

    expect(filter.level).toBe('LEVEL_2_MID');
    expect(filter.experienceYears).toEqual({ $gte: 3, $lte: 8 });
    expect((filter.field as RegExp).test('devops engineer')).toBe(true);
  });

  it('searches names, fields, bios and skills case-insensitively', () => {
    const filter = buildTalentFilter({ search: 'neha' });
    expect(Array.isArray(filter.$or)).toBe(true);
    expect(filter.$or).toHaveLength(4);
    const nameClause = filter.$or?.[0] as { name: RegExp };
    expect(nameClause.name.test('Neha Chatterjee')).toBe(true);
    expect(nameClause.name.test('Saurabh')).toBe(false);
  });

  it('applies a lower bound when only minExperienceYears is supplied', () => {
    expect(buildTalentFilter({ minExperienceYears: 5 }).experienceYears).toEqual({
      $gte: 5,
    });
  });

  it('limits a recruiter pipeline query to the supplied talent ids', () => {
    const filter = buildTalentFilter({
      talentIds: ['99999999-9999-4999-8999-999999999999', '88888888-8888-4888-8888-888888888888'],
      field: 'Backend',
    });

    expect(filter._id).toEqual({
      $in: ['99999999-9999-4999-8999-999999999999', '88888888-8888-4888-8888-888888888888'],
    });
    expect((filter.field as RegExp).test('backend')).toBe(true);
  });

  it('returns no rows for an explicitly empty pipeline scope', () => {
    expect(buildTalentFilter({ talentIds: [] })._id).toEqual({ $in: [] });
    expect(buildTalentFilter({})).not.toHaveProperty('_id');
  });
});

describe('blind review', () => {
  const profile: TalentProfile = {
    id: '99999999-9999-4999-8999-999999999999',
    userId: '11111111-1111-4111-8111-111111111111',
    name: 'Neha Chatterjee',
    email: 'neha@example.com',
    phone: '+91-9123456780',
    field: 'DevOps Engineer',
    skills: ['Docker', 'Kubernetes'],
    experienceYears: 6,
    education: [
      {
        college: 'MIT Academy of Engineering',
        degree: 'B.E.',
        branchOfStudy: 'Information Technology',
        yearOfGraduation: 2021,
      },
    ],
    previousExperience: [
      {
        company: 'Zensar',
        role: 'DevOps Engineer',
        durationMonths: 36,
        responsibilities: ['Managed CI/CD pipelines'],
      },
    ],
    level: 'LEVEL_3_LEAD',
    bio: 'Neha is a platform engineer reachable at neha@example.com.',
    portfolioUrl: 'https://portfolio.example.com',
    linkedinUrl: 'https://linkedin.com/in/neha',
    githubUrl: 'https://github.com/platform-labs',
    resumeUrl: 'https://resume.example.com/neha.pdf',
    createdAt: '2026-11-05T00:00:00.000Z',
    updatedAt: '2026-11-05T00:00:00.000Z',
  };

  it('derives a stable, non-identifying candidate reference', () => {
    expect(blindCandidateRef(profile.id)).toBe('Candidate #999999');
    expect(blindCandidateRef('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe('Candidate #AAAAAA');
  });

  it('strips identity, contact details, tier and profile links', () => {
    const blind = toBlindTalentProfile(profile);

    expect(blind).not.toHaveProperty('name');
    expect(blind).not.toHaveProperty('email');
    expect(blind).not.toHaveProperty('phone');
    expect(blind).not.toHaveProperty('userId');
    expect(blind).not.toHaveProperty('level');
    expect(blind).not.toHaveProperty('bio');
    expect(blind).not.toHaveProperty('linkedinUrl');
    expect(blind).not.toHaveProperty('resumeUrl');
    expect(JSON.stringify(blind)).not.toContain('neha');
  });

  it('keeps the qualifications needed to evaluate the candidate', () => {
    const blind = toBlindTalentProfile(profile);

    expect(blind.candidateRef).toBe('Candidate #999999');
    expect(blind.field).toBe('DevOps Engineer');
    expect(blind.skills).toEqual(['Docker', 'Kubernetes']);
    expect(blind.experienceYears).toBe(6);
    expect(blind.education[0]?.college).toBe('MIT Academy of Engineering');
    expect(blind.previousExperience[0]?.role).toBe('DevOps Engineer');
    expect(blind.portfolioUrl).toBe('https://portfolio.example.com');
    expect(blind.githubUrl).toBe('https://github.com/platform-labs');
  });

  it('cannot filter or search by tier, name or bio', () => {
    const filter = buildBlindTalentFilter({ search: 'neha', minExperienceYears: 3 });

    expect(filter.level).toBeUndefined();
    expect(filter.experienceYears).toEqual({ $gte: 3 });
    expect(filter.$or).toHaveLength(2);
    expect(JSON.stringify(filter)).not.toContain('name');
  });

  it('excludes candidates the recruiter already screened', () => {
    const filter = buildBlindTalentFilter({}, [
      '99999999-9999-4999-8999-999999999999',
      '88888888-8888-4888-8888-888888888888',
    ]);

    expect(filter._id).toEqual({
      $nin: ['99999999-9999-4999-8999-999999999999', '88888888-8888-4888-8888-888888888888'],
    });
  });

  it('omits the exclusion clause when nothing has been screened', () => {
    expect(buildBlindTalentFilter({})).not.toHaveProperty('_id');
  });
});

describe('qualification update detection', () => {
  it('treats evaluation-relevant fields as qualification changes', () => {
    expect(hasTalentQualificationChanges(['skills'])).toBe(true);
    expect(hasTalentQualificationChanges(['previousExperience'])).toBe(true);
    expect(hasTalentQualificationChanges(['education', 'name'])).toBe(true);
    expect(hasTalentQualificationChanges(['portfolioUrl', 'githubUrl'])).toBe(true);
  });

  it('ignores identity and contact-only edits', () => {
    expect(hasTalentQualificationChanges(['name'])).toBe(false);
    expect(hasTalentQualificationChanges(['email', 'phone'])).toBe(false);
    expect(hasTalentQualificationChanges(['linkedinUrl'])).toBe(false);
    expect(hasTalentQualificationChanges([])).toBe(false);
  });
});

describe('buildPaginationMeta', () => {
  it('computes page metadata for a partial page', () => {
    expect(buildPaginationMeta({ page: 2, limit: 10, total: 25 })).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('handles an empty result set', () => {
    expect(buildPaginationMeta({ page: 1, limit: 20, total: 0 })).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});

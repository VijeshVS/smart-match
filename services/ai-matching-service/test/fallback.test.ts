import { describe, expect, it } from 'vitest';
import {
  extractQueryFilters,
  extractSkills,
  localRerank,
  localSuggestions,
  localSummary,
} from '../src/ai/fallback.js';
import type { AiProfile } from '../src/ai/types.js';

const profile: AiProfile = {
  talentId: '507f1f77bcf86cd799439011',
  name: 'Ada Lovelace',
  field: 'Software Engineering',
  skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
  experienceYears: 6,
  level: 'LEVEL_2_MID',
  bio: 'Product-minded engineer who ships reliable web platforms.',
  education: [
    {
      college: 'Example University',
      degree: 'B.Tech',
      branchOfStudy: 'Computer Science',
      yearOfGraduation: 2018,
    },
  ],
  previousExperience: [
    {
      company: 'Acme',
      role: 'Senior Engineer',
      durationMonths: 30,
      responsibilities: ['Led the platform migration to React'],
    },
  ],
};

describe('fallback query interpretation', () => {
  it('extracts skills, level and minimum experience', () => {
    const result = extractQueryFilters(
      'Looking for senior DevOps with Terraform and AWS experience and 5+ years',
    );

    expect(result.filters.level).toBe('LEVEL_3_LEAD');
    expect(result.filters.skills).toEqual(expect.arrayContaining(['Terraform', 'AWS', 'DevOps']));
    expect(result.filters.minExperienceYears).toBe(5);
  });

  it('extracts an experience range', () => {
    const result = extractQueryFilters('Need between 2 and 4 years of React experience');
    expect(result.filters.minExperienceYears).toBe(2);
    expect(result.filters.maxExperienceYears).toBe(4);
  });

  it('keeps explicit filters over inferred ones', () => {
    const result = extractQueryFilters('senior React engineer', {
      level: 'LEVEL_1_ENTRY',
      skills: ['Vue'],
    });

    expect(result.filters.level).toBe('LEVEL_1_ENTRY');
    expect(result.filters.skills).toEqual(['Vue']);
  });

  it('recognises multi-word skills without duplicating single words', () => {
    expect(extractSkills('machine learning with Python and PyTorch')).toEqual(
      expect.arrayContaining(['Machine Learning', 'Python', 'PyTorch']),
    );
  });
});

describe('fallback content generation', () => {
  it('produces a profile summary grounded in the profile', () => {
    const summary = localSummary(profile);
    expect(summary.length).toBeGreaterThanOrEqual(3);
    expect(summary.join(' ')).toContain('Ada Lovelace');
    expect(summary.join(' ')).toContain('React');
  });

  it('produces actionable suggestions and addresses missing cloud skills', () => {
    const suggestions = localSuggestions(profile, ['Add measurable impact to your roles']);
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    expect(suggestions.join(' ').toLowerCase()).toContain('cloud');
    expect(suggestions.join(' ')).toContain('measurable impact');
  });

  it('ranks matching profiles above unrelated profiles', () => {
    const related = localRerank('React TypeScript engineer', profile);
    const unrelated = localRerank('Payroll accountant with SAP', profile);

    expect(related.score).toBeGreaterThan(unrelated.score);
    expect(related.matchedSkills).toEqual(expect.arrayContaining(['React', 'TypeScript']));
    expect(related.rationale.length).toBeGreaterThan(0);
  });
});

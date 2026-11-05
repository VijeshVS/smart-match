import { describe, expect, it } from 'vitest';
import {
  buildPaginationMeta,
  buildTalentFilter,
  caseInsensitiveExact,
  deriveTalentLevel,
  escapeRegex,
  normalizeSkills,
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

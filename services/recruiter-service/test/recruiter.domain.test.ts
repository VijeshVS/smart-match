import { describe, expect, it } from 'vitest';
import {
  buildJobWhere,
  buildPaginationMeta,
  normalizeOrganizationDomain,
  normalizeOrganizationName,
  normalizeSkills,
  recruiterPermissionsForRole,
  toJobPosting,
  toOrganization,
  toRecruiterProfile,
} from '../src/domain/recruiter.js';

describe('recruiter domain', () => {
  it('grants recruiter capabilities by role', () => {
    expect(recruiterPermissionsForRole('RECRUITER')).toContain('recruiter:write');
    expect(recruiterPermissionsForRole('RECRUITER')).toContain('talent:unlock');
    expect(recruiterPermissionsForRole('CANDIDATE')).toEqual([]);
    expect(recruiterPermissionsForRole('ADMIN')).toContain('analytics:read');
  });

  it('normalizes organization names and website domains', () => {
    expect(normalizeOrganizationName('  Acme   Hiring  ')).toBe('Acme Hiring');
    expect(normalizeOrganizationDomain('https://www.Acme.com/about')).toBe('acme.com');
    expect(normalizeOrganizationDomain('acme.com')).toBe('acme.com');
    expect(normalizeOrganizationDomain('https://acme.com.')).toBe('acme.com');
    expect(normalizeOrganizationDomain('not a domain')).toBeUndefined();
    expect(normalizeOrganizationDomain()).toBeUndefined();
  });

  it('de-duplicates skills case-insensitively while keeping canonical casing', () => {
    expect(normalizeSkills(['  Node.js ', 'node.js', 'React', '', ' React '])).toEqual([
      'Node.js',
      'React',
    ]);
  });

  it('only exposes open jobs to candidates', () => {
    expect(buildJobWhere({}, 'CANDIDATE').status).toBe('OPEN');
    expect(buildJobWhere({ status: 'ALL' }, 'CANDIDATE').status).toBe('OPEN');
    expect(buildJobWhere({ status: 'DRAFT' }, 'CANDIDATE').status).toBe('OPEN');

    expect(buildJobWhere({ status: 'DRAFT' }, 'RECRUITER').status).toBe('DRAFT');
    expect(buildJobWhere({ status: 'ALL' }, 'RECRUITER').status).toBeUndefined();
  });

  it('builds recruiter filters for skills, location and search', () => {
    const where = buildJobWhere(
      {
        status: 'OPEN',
        employmentType: 'CONTRACT',
        organizationId: '11111111-1111-4111-8111-111111111111',
        location: 'Berlin',
        skills: ['Node.js', 'node.js', 'TypeScript'],
        search: 'platform',
      },
      'RECRUITER',
    );

    expect(where).toMatchObject({
      status: 'OPEN',
      employmentType: 'CONTRACT',
      organizationId: '11111111-1111-4111-8111-111111111111',
      location: { contains: 'Berlin', mode: 'insensitive' },
      requiredSkills: { hasSome: ['Node.js', 'TypeScript'] },
    });
    expect(where.OR).toHaveLength(3);
  });

  it('computes pagination metadata including the empty result', () => {
    expect(buildPaginationMeta({ page: 2, limit: 20, total: 45 })).toEqual({
      page: 2,
      limit: 20,
      total: 45,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });

    expect(buildPaginationMeta({ page: 1, limit: 20, total: 0 })).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('maps database rows to the shared API contract', () => {
    const now = new Date('2026-11-05T00:00:00.000Z');
    const organization = toOrganization({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Acme',
      domain: 'acme.com',
      website: 'https://acme.com',
      logoUrl: null,
      industry: null,
      size: null,
      billingEmail: null,
      createdAt: now,
      updatedAt: now,
    });
    expect(organization).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Acme',
      domain: 'acme.com',
      website: 'https://acme.com',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    const profile = toRecruiterProfile({
      id: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      organizationId: organization.id,
      fullName: 'Riley Recruiter',
      email: 'riley@acme.com',
      title: 'Head of Talent',
      phone: null,
      permissions: ['recruiter:read'],
      createdAt: now,
      updatedAt: now,
    });
    expect(profile.title).toBe('Head of Talent');
    expect(profile.phone).toBeUndefined();
    expect(profile.permissions).toEqual(['recruiter:read']);

    const job = toJobPosting({
      id: '44444444-4444-4444-8444-444444444444',
      organizationId: organization.id,
      recruiterId: profile.id,
      title: 'Staff Engineer',
      description: 'Build the platform.',
      location: null,
      employmentType: 'FULL_TIME',
      requiredSkills: ['TypeScript'],
      minExperienceYears: null,
      maxExperienceYears: 10,
      status: 'OPEN',
      createdAt: now,
      updatedAt: now,
    });
    expect(job.employmentType).toBe('FULL_TIME');
    expect(job.minExperienceYears).toBeUndefined();
    expect(job.maxExperienceYears).toBe(10);
  });
});

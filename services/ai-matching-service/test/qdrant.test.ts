import { describe, expect, it } from 'vitest';
import { buildQdrantFilter, toPointId } from '../src/lib/qdrant.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('toPointId', () => {
  it('derives a stable UUID from a Mongo ObjectId', () => {
    const first = toPointId('507f1f77bcf86cd799439011');
    const second = toPointId('507f1f77bcf86cd799439011');

    expect(first).toBe(second);
    expect(first).toMatch(UUID_PATTERN);
  });

  it('derives different ids for different talents', () => {
    expect(toPointId('507f1f77bcf86cd799439011')).not.toBe(toPointId('507f1f77bcf86cd799439012'));
  });
});

describe('buildQdrantFilter', () => {
  it('returns undefined when no filter is requested', () => {
    expect(buildQdrantFilter({})).toBeUndefined();
  });

  it('lowercases skill filters and builds a range filter', () => {
    const filter = buildQdrantFilter({
      skills: ['React', 'Node.js'],
      level: 'LEVEL_2_MID',
      minExperienceYears: 3,
      maxExperienceYears: 8,
    }) as { must: Array<Record<string, unknown>> };

    expect(filter.must).toEqual([
      { key: 'skillsLower', match: { any: ['react', 'node.js'] } },
      { key: 'level', match: { value: 'LEVEL_2_MID' } },
      { key: 'experienceYears', range: { gte: 3, lte: 8 } },
    ]);
  });

  it('lowercases the field filter', () => {
    const filter = buildQdrantFilter({ field: 'Software Engineering' }) as {
      must: Array<Record<string, unknown>>;
    };
    expect(filter.must).toEqual([{ key: 'fieldLower', match: { value: 'software engineering' } }]);
  });
});

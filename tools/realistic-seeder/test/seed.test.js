import assert from 'node:assert/strict';
import test from 'node:test';
import { ObjectId } from 'mongodb';

import { assertSafeEnvironment, parseOptions } from '../src/config.js';
import { buildDataset } from '../src/data.js';
import { buildEmbeddingText, localEmbedding } from '../src/embedding.js';
import { validateDataset } from '../src/index.js';
import { deterministicUuid, toPointId } from '../src/random.js';
import {
  normalizePostgresUrl,
  notificationDocuments,
  talentProfileDocuments,
} from '../src/seeders.js';

const ANCHOR = Date.parse('2026-11-08T00:00:00.000Z');
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function dataset(overrides = {}) {
  return buildDataset({
    seed: 'test-seed',
    count: 12,
    anchorMs: ANCHOR,
    ...overrides,
  });
}

test('the same seed and anchor produce byte-identical datasets', () => {
  const first = dataset();
  const second = dataset();
  assert.deepEqual(first, second);
});

test('a different seed changes identifiers and activity', () => {
  const first = dataset();
  const second = dataset({ seed: 'another-seed' });
  assert.notEqual(first.candidates[0].talentId, second.candidates[0].talentId);
  assert.notDeepEqual(first.swipes, second.swipes);
});

test('counts scale predictably with the candidate count', () => {
  const small = dataset({ count: 6 });
  const large = dataset({ count: 36 });
  assert.equal(small.candidates.length, 6);
  assert.equal(small.recruiters.length, 3);
  assert.equal(large.candidates.length, 36);
  assert.equal(large.recruiters.length, 6);
});

test('the generated dataset passes referential and privacy validation', () => {
  const summary = validateDataset(dataset());
  assert.equal(summary.candidates, 12);
  assert.ok(summary.swipes > 0);
  assert.ok(summary.notifications > 0);
  assert.ok(summary.qdrantPoints > 0);
});

test('validation rejects non-synthetic contact details', () => {
  const broken = dataset();
  broken.candidates[0].email = 'someone@example.com';
  assert.throws(() => validateDataset(broken), /non-synthetic email/);
});

test('validation rejects dangling foreign keys', () => {
  const broken = dataset();
  broken.swipes[0].talentId = deterministicUuid('other', 'missing');
  assert.throws(() => validateDataset(broken), /unknown talent/);
});

test('validation rejects duplicate event ids', () => {
  const broken = dataset();
  broken.events[1].eventId = broken.events[0].eventId;
  assert.throws(() => validateDataset(broken), /duplicate event ids/);
});

test('all identifiers are deterministic UUIDs', () => {
  const value = deterministicUuid('test-seed', 'candidate:1');
  assert.match(value, UUID_PATTERN);
  assert.equal(value, deterministicUuid('test-seed', 'candidate:1'));
  assert.notEqual(value, deterministicUuid('test-seed', 'candidate:2'));
});

test('Qdrant point ids are stable UUIDs derived from the talent id', () => {
  const talentId = deterministicUuid('test-seed', 'talent:0');
  const pointId = toPointId(talentId);
  assert.match(pointId, UUID_PATTERN);
  assert.equal(pointId, toPointId(talentId));
});

test('Qdrant points use the AI service point-id mapping and payload shape', () => {
  const data = dataset();
  for (const candidate of data.candidates) {
    const point = data.qdrantPoints.find((entry) => entry.payload.talentId === candidate.talentId);
    assert.ok(point, `missing point for ${candidate.talentId}`);
    assert.equal(point.id, toPointId(candidate.talentId));
    assert.equal(point.payload.fieldLower, candidate.field.toLowerCase());
    assert.deepEqual(point.payload.skillsLower, candidate.skills.map((skill) => skill.toLowerCase()));
    assert.equal(point.vector.length, 384);
  }
});

test('the local embedding is deterministic, normalised and searchable', () => {
  const profile = dataset().candidates[0];
  const text = buildEmbeddingText(profile);
  const first = localEmbedding(text, 384);
  const second = localEmbedding(text, 384);

  assert.deepEqual(first, second);
  assert.equal(first.length, 384);

  const magnitude = Math.sqrt(first.reduce((total, value) => total + value * value, 0));
  assert.ok(Math.abs(magnitude - 1) < 1e-9);

  const reordered = localEmbedding(`${text} `, 384);
  assert.deepEqual(first, reordered);
});

test('parseOptions supports environment defaults and explicit flags', () => {
  const options = parseOptions([], { SEED: 'env-seed', SEED_COUNT: '8' });
  assert.equal(options.seed, 'env-seed');
  assert.equal(options.count, 8);
  assert.equal(options.reset, false);
  assert.equal(options.publishEvents, false);

  const parsed = parseOptions(
    [
      '--seed=cli-seed',
      '--count',
      '10',
      '--anchor',
      '2026-01-02T03:04:05Z',
      '--reset',
      '--publish',
      '--dry-run',
      '--',
    ],
    {},
  );
  assert.equal(parsed.seed, 'cli-seed');
  assert.equal(parsed.count, 10);
  assert.equal(parsed.reset, true);
  assert.equal(parsed.publishEvents, true);
  assert.equal(parsed.dryRun, true);
  assert.equal(new Date(parsed.anchorMs).toISOString(), '2026-01-02T03:04:05.000Z');
});

test('parseOptions rejects invalid counts, empty seeds and unknown flags', () => {
  assert.throws(() => parseOptions(['--count', '5'], {}), /between 6 and 500/);
  assert.throws(() => parseOptions(['--count', '501'], {}), /between 6 and 500/);
  assert.throws(() => parseOptions(['--count', 'abc'], {}), /between 6 and 500/);
  assert.throws(() => parseOptions(['--seed', ''], {}), /seed must not be empty/);
  assert.throws(() => parseOptions(['--nope'], {}), /Unknown argument/);
  assert.throws(() => parseOptions(['--count'], {}), /requires a value/);
  assert.throws(() => parseOptions(['--anchor', 'not-a-date'], {}), /Invalid --anchor/);
});

test('production is blocked unless explicitly allowed', () => {
  assert.throws(
    () => assertSafeEnvironment({ reset: false, env: { NODE_ENV: 'production' } }),
    /Refusing to seed production/,
  );

  assert.doesNotThrow(() =>
    assertSafeEnvironment({
      reset: false,
      env: { NODE_ENV: 'production', SEED_ALLOW_PRODUCTION: 'true' },
    }),
  );
});

test('--reset is blocked in production even when production seeding is allowed', () => {
  assert.throws(
    () =>
      assertSafeEnvironment({
        reset: true,
        env: { NODE_ENV: 'production', SEED_ALLOW_PRODUCTION: 'true' },
      }),
    /--reset is blocked in production/,
  );
});

test('--reset is limited to local, development and test', () => {
  assert.doesNotThrow(() => assertSafeEnvironment({ reset: true, env: { NODE_ENV: 'test' } }));
  assert.doesNotThrow(() =>
    assertSafeEnvironment({ reset: true, env: { NODE_ENV: 'development' } }),
  );
  assert.throws(
    () => assertSafeEnvironment({ reset: true, env: { NODE_ENV: 'staging' } }),
    /--reset is not allowed/,
  );
});

test('Prisma schema query parameters are stripped for pg', () => {
  assert.equal(
    normalizePostgresUrl('postgresql://user:pass@localhost:5432/db?schema=public'),
    'postgresql://user:pass@localhost:5432/db',
  );
});

test('Mongo documents use deterministic ids and native dates', () => {
  const data = dataset();
  const [profile] = talentProfileDocuments(data);
  assert.equal(profile._id, data.candidates[0].talentId);
  assert.ok(profile.createdAt instanceof Date);
  assert.ok(profile.previousExperience.every((entry) => entry.startDate instanceof Date));

  const [notification] = notificationDocuments(data);
  assert.ok(notification._id instanceof ObjectId);
  assert.equal(notification._id.toHexString(), data.notifications[0].id);
  assert.ok(notification.createdAt instanceof Date);
});

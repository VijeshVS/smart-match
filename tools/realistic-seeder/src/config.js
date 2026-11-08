import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

dotenv.config({
  path: [path.join(ROOT, '.env.local'), path.join(ROOT, '.env')],
});

export const DEFAULT_SEED = 'talent-ai-phase-11';
export const DEFAULT_COUNT = 24;

function usage() {
  return `talent.ai realistic seeder

Usage:
  pnpm run db:seed:realistic [options]

Options:
  --seed <value>        Deterministic seed (default: ${DEFAULT_SEED})
  --count <number>      Base candidate count (default: ${DEFAULT_COUNT})
  --anchor <iso-date>   Timestamp the generated history is relative to
  --publish             Publish the generated domain events to RabbitMQ
  --reset               Delete seeded data first (local/test only)
  --dry-run             Build and validate the dataset without writing it
  --help                Show this help

Environment:
  SEED, SEED_COUNT, SEED_ANCHOR, SEED_PUBLISH_EVENTS
  SEED_ALLOW_PRODUCTION=true   Explicitly allow a production data seed
                               (--reset is still blocked in production)

Datastore URLs default to the local Docker Compose stack and can be overridden
with DATABASE_URL, *_DATABASE_URL, MONGODB_URI, NOTIFICATION_MONGODB_URI,
QDRANT_URL, QDRANT_COLLECTION, EMBEDDING_DIMENSIONS and RABBITMQ_URL.
`;
}

function readValue(argv, index, name) {
  const current = argv[index];
  if (current.includes('=')) return { value: current.split('=').slice(1).join('='), index };
  const next = argv[index + 1];
  if (next === undefined || next.startsWith('--')) {
    throw new Error(`--${name} requires a value`);
  }
  return { value: next, index: index + 1 };
}

export function parseOptions(argv = process.argv.slice(2), env = process.env) {
  const options = {
    seed: env.SEED || DEFAULT_SEED,
    count: Number(env.SEED_COUNT || DEFAULT_COUNT),
    anchor: env.SEED_ANCHOR,
    reset: false,
    publishEvents: env.SEED_PUBLISH_EVENTS === 'true',
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    // pnpm forwards a literal `--` separator; it is not a seeder option.
    if (arg === '--') {
      continue;
    }
    if (arg === '--reset') {
      options.reset = true;
      continue;
    }
    if (arg === '--publish' || arg === '--publish-events') {
      options.publishEvents = true;
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith('--seed')) {
      const parsed = readValue(argv, index, 'seed');
      options.seed = parsed.value;
      index = parsed.index;
      continue;
    }
    if (arg.startsWith('--count')) {
      const parsed = readValue(argv, index, 'count');
      options.count = Number(parsed.value);
      index = parsed.index;
      continue;
    }
    if (arg.startsWith('--anchor')) {
      const parsed = readValue(argv, index, 'anchor');
      options.anchor = parsed.value;
      index = parsed.index;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.seed || String(options.seed).trim().length === 0) {
    throw new Error('The seed must not be empty');
  }
  if (!Number.isInteger(options.count) || options.count < 6 || options.count > 500) {
    throw new Error('--count must be an integer between 6 and 500');
  }

  const anchorDate = options.anchor ? new Date(options.anchor) : new Date();
  if (Number.isNaN(anchorDate.getTime())) {
    throw new Error(`Invalid --anchor value: ${options.anchor}`);
  }
  // Truncating to the hour makes repeated runs within the same hour identical
  // while keeping generated activity inside dashboard time ranges.
  options.anchorMs = options.anchor
    ? anchorDate.getTime()
    : Math.floor(anchorDate.getTime() / 3_600_000) * 3_600_000;

  return options;
}

/**
 * Production is denied by default. `SEED_ALLOW_PRODUCTION=true` is an explicit
 * opt-in for seeding a read-only demo environment; destructive reset remains
 * blocked everywhere outside development/test.
 */
export function assertSafeEnvironment({ reset, env = process.env }) {
  const nodeEnv = (env.NODE_ENV || 'development').toLowerCase();
  const production = nodeEnv === 'production';
  const allowProduction = env.SEED_ALLOW_PRODUCTION === 'true';

  if (production && !allowProduction) {
    throw new Error(
      'Refusing to seed production. Set SEED_ALLOW_PRODUCTION=true only for an intentional, reviewed demo seed.',
    );
  }

  if (reset && production) {
    throw new Error('--reset is blocked in production; it is only allowed in development and test.');
  }

  if (reset && !['development', 'test', 'local'].includes(nodeEnv)) {
    throw new Error(`--reset is not allowed when NODE_ENV=${nodeEnv}`);
  }
}

function databaseFromMongoUri(uri, fallback) {
  try {
    const parsed = new URL(uri);
    const name = parsed.pathname.replace(/^\//, '');
    return name || fallback;
  } catch {
    return fallback;
  }
}

export function readStoreConfig(env = process.env) {
  const talentMongoUri =
    env.MONGODB_URI || 'mongodb://localhost:27017/talent_profiles?directConnection=true';
  const notificationMongoUri =
    env.NOTIFICATION_MONGODB_URI ||
    'mongodb://localhost:27017/talent_notif?directConnection=true';

  return {
    postgres: {
      auth: env.DATABASE_URL || 'postgresql://talent:talent@localhost:5432/talent_auth',
      recruiter:
        env.RECRUITER_DATABASE_URL ||
        'postgresql://talent:talent@localhost:5432/talent_recruiter?schema=public',
      engagement:
        env.ENGAGEMENT_DATABASE_URL ||
        'postgresql://talent:talent@localhost:5432/talent_engagement?schema=public',
      rewards:
        env.REWARDS_DATABASE_URL ||
        'postgresql://talent:talent@localhost:5432/talent_rewards?schema=public',
      analytics:
        env.ANALYTICS_DATABASE_URL ||
        'postgresql://talent:talent@localhost:5432/talent_analytics?schema=public',
    },
    mongo: {
      talentUri: talentMongoUri,
      talentDb: env.MONGODB_DB || databaseFromMongoUri(talentMongoUri, 'talent_profiles'),
      notificationUri: notificationMongoUri,
      notificationDb:
        env.NOTIFICATION_MONGODB_DB ||
        databaseFromMongoUri(notificationMongoUri, 'talent_notif'),
    },
    qdrant: {
      url: (env.QDRANT_URL || 'http://localhost:6333').replace(/\/$/, ''),
      collection: env.QDRANT_COLLECTION || 'talent_profiles',
      dimensions: Number(env.EMBEDDING_DIMENSIONS || 384),
      apiKey: env.QDRANT_API_KEY || undefined,
    },
    rabbitmq: {
      url: env.RABBITMQ_URL || 'amqp://talent:talent@localhost:5672',
      exchange: env.RABBITMQ_EXCHANGE || 'talent.events.topic',
    },
  };
}

export function printUsage() {
  process.stdout.write(usage());
}

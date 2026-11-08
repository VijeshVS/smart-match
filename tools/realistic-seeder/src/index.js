import { MongoClient } from 'mongodb';
import { pathToFileURL } from 'node:url';

import {
  assertSafeEnvironment,
  parseOptions,
  printUsage,
  readStoreConfig,
} from './config.js';
import { buildDataset, SEED_PASSWORD } from './data.js';
import { toPointId } from './random.js';
import {
  publishEvents,
  resetMongo,
  resetPostgres,
  resetQdrant,
  seedAnalytics,
  seedAuth,
  seedEngagement,
  seedMongo,
  seedQdrant,
  seedRecruiter,
  seedRewards,
} from './seeders.js';

const DATASET_KEYS = [
  'organizations',
  'candidates',
  'recruiters',
  'jobs',
  'swipes',
  'reviews',
  'wallets',
  'ledgerTransactions',
  'grants',
  'evaluations',
  'notifications',
  'events',
  'qdrantPoints',
];

const EMAIL_SUFFIX = '@synthetic.talent.test';

/**
 * Fails fast on referential or privacy problems before anything touches a
 * datastore. The seeder is intentionally strict: a partially valid dataset is
 * worse than a clear error.
 */
export function validateDataset(dataset) {
  if (!dataset || typeof dataset !== 'object') {
    throw new Error('Dataset is empty');
  }

  for (const key of DATASET_KEYS) {
    if (!Array.isArray(dataset[key])) {
      throw new Error(`Dataset.${key} must be an array`);
    }
  }

  if (dataset.candidates.length === 0) throw new Error('Dataset has no candidates');
  if (dataset.recruiters.length === 0) throw new Error('Dataset has no recruiters');
  if (dataset.organizations.length === 0) throw new Error('Dataset has no organizations');

  const candidateIds = new Set(dataset.candidates.map((candidate) => candidate.talentId));
  const candidateUserIds = new Set(dataset.candidates.map((candidate) => candidate.userId));
  const recruiterUserIds = new Set(dataset.recruiters.map((recruiter) => recruiter.userId));
  const recruiterProfileIds = new Set(dataset.recruiters.map((recruiter) => recruiter.profileId));
  const organizationIds = new Set(dataset.organizations.map((organization) => organization.id));
  const jobIds = new Set(dataset.jobs.map((job) => job.id));
  const swipeIds = new Set(dataset.swipes.map((swipe) => swipe.id));
  const walletIds = new Set(dataset.wallets.map((wallet) => wallet.id));
  const notificationIds = new Set(dataset.notifications.map((notification) => notification.id));

  const unique = (values, label) => {
    if (new Set(values).size !== values.length) {
      throw new Error(`Dataset contains duplicate ${label}`);
    }
  };

  unique([...candidateIds], 'candidate talent ids');
  unique([...candidateUserIds], 'candidate user ids');
  unique([...recruiterUserIds], 'recruiter user ids');
  unique([...recruiterProfileIds], 'recruiter profile ids');
  unique([...notificationIds], 'notification ids');
  unique(
    dataset.events.map((event) => event.eventId),
    'event ids',
  );
  unique(
    dataset.qdrantPoints.map((point) => point.id),
    'qdrant point ids',
  );

  for (const candidate of dataset.candidates) {
    if (!candidate.email.endsWith(EMAIL_SUFFIX)) {
      throw new Error(`Candidate ${candidate.talentId} uses a non-synthetic email`);
    }
    if (!candidate.phone.startsWith('+1-555-')) {
      throw new Error(`Candidate ${candidate.talentId} uses a non-synthetic phone number`);
    }
  }

  for (const recruiter of dataset.recruiters) {
    if (!recruiter.email.endsWith(EMAIL_SUFFIX)) {
      throw new Error(`Recruiter ${recruiter.profileId} uses a non-synthetic email`);
    }
    if (!recruiter.phone.startsWith('+1-555-')) {
      throw new Error(`Recruiter ${recruiter.profileId} uses a non-synthetic phone number`);
    }
    if (!organizationIds.has(recruiter.organizationId)) {
      throw new Error(`Recruiter ${recruiter.profileId} references an unknown organization`);
    }
  }

  for (const job of dataset.jobs) {
    if (!organizationIds.has(job.organizationId)) {
      throw new Error(`Job ${job.id} references an unknown organization`);
    }
    if (!recruiterProfileIds.has(job.recruiterProfileId)) {
      throw new Error(`Job ${job.id} references an unknown recruiter profile`);
    }
  }

  for (const swipe of dataset.swipes) {
    if (!candidateIds.has(swipe.talentId)) {
      throw new Error(`Swipe ${swipe.id} references an unknown talent`);
    }
    if (!recruiterUserIds.has(swipe.recruiterUserId)) {
      throw new Error(`Swipe ${swipe.id} references an unknown recruiter`);
    }
  }

  for (const review of dataset.reviews) {
    if (!candidateIds.has(review.talentId)) {
      throw new Error(`Review ${review.id} references an unknown talent`);
    }
    if (!recruiterUserIds.has(review.recruiterUserId)) {
      throw new Error(`Review ${review.id} references an unknown recruiter`);
    }
    if (!swipeIds.has(review.swipeId)) {
      throw new Error(`Review ${review.id} references an unknown swipe`);
    }
  }

  for (const wallet of dataset.wallets) {
    if (!recruiterUserIds.has(wallet.recruiterUserId)) {
      throw new Error(`Wallet ${wallet.id} references an unknown recruiter`);
    }
  }

  for (const transaction of dataset.ledgerTransactions) {
    if (!walletIds.has(transaction.walletId)) {
      throw new Error(`Ledger transaction ${transaction.id} references an unknown wallet`);
    }
    if (!recruiterUserIds.has(transaction.recruiterUserId)) {
      throw new Error(`Ledger transaction ${transaction.id} references an unknown recruiter`);
    }
  }

  for (const grant of dataset.grants) {
    if (!candidateIds.has(grant.talentId)) {
      throw new Error(`Grant ${grant.id} references an unknown talent`);
    }
    if (!recruiterUserIds.has(grant.recruiterUserId)) {
      throw new Error(`Grant ${grant.id} references an unknown recruiter`);
    }
  }

  for (const notification of dataset.notifications) {
    if (!candidateUserIds.has(notification.userId) && !recruiterUserIds.has(notification.userId)) {
      throw new Error(`Notification ${notification.id} references an unknown user`);
    }
  }

  for (const event of dataset.events) {
    if (!event.eventType || !event.aggregateId) {
      throw new Error(`Event ${event.eventId} is missing its type or aggregate id`);
    }
  }

  const pointIds = new Set(dataset.qdrantPoints.map((point) => point.id));
  for (const candidate of dataset.candidates) {
    const expected = toPointId(candidate.talentId);
    if (!pointIds.has(expected)) {
      throw new Error(`Qdrant point for talent ${candidate.talentId} is missing`);
    }
  }

  return {
    candidates: dataset.candidates.length,
    recruiters: dataset.recruiters.length,
    organizations: dataset.organizations.length,
    jobs: dataset.jobs.length,
    swipes: dataset.swipes.length,
    reviews: dataset.reviews.length,
    wallets: dataset.wallets.length,
    ledgerTransactions: dataset.ledgerTransactions.length,
    grants: dataset.grants.length,
    evaluations: dataset.evaluations.length,
    notifications: dataset.notifications.length,
    events: dataset.events.length,
    qdrantPoints: dataset.qdrantPoints.length,
    jobIds: jobIds.size,
    candidateUserIds: candidateUserIds.size,
  };
}

function formatCounts(counts) {
  return Object.entries(counts)
    .filter(([, value]) => typeof value === 'number')
    .map(([key, value]) => `  ${key.padEnd(24)} ${value}`)
    .join('\n');
}

async function connectMongo(config) {
  const talent = new MongoClient(config.mongo.talentUri, { serverSelectionTimeoutMS: 10_000 });
  const notification = new MongoClient(config.mongo.notificationUri, {
    serverSelectionTimeoutMS: 10_000,
  });

  await Promise.all([talent.connect(), notification.connect()]);

  return {
    talent: { client: talent, dbName: config.mongo.talentDb },
    notification: { client: notification, dbName: config.mongo.notificationDb },
  };
}

async function closeMongo(clients) {
  await Promise.allSettled([
    clients?.talent?.client?.close(),
    clients?.notification?.client?.close(),
  ]);
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const options = parseOptions(argv, env);

  if (options.help) {
    printUsage();
    return { help: true };
  }

  assertSafeEnvironment({ reset: options.reset, env });

  const dataset = buildDataset({
    seed: options.seed,
    count: options.count,
    anchorMs: options.anchorMs,
  });
  const summary = validateDataset(dataset);

  process.stdout.write(
    [
      `Deterministic seed: ${dataset.seed}`,
      `Anchor:            ${new Date(dataset.anchorMs).toISOString()}`,
      '',
      'Dataset',
      formatCounts(summary),
      '',
    ].join('\n'),
  );

  if (options.dryRun) {
    process.stdout.write('Dry run: dataset validated, nothing was written.\n');
    return { dryRun: true, summary };
  }

  const config = readStoreConfig(env);
  let mongoClients;

  try {
    if (options.reset) {
      process.stdout.write('Reset: removing previously seeded records...\n');
      await resetQdrant(config.qdrant, dataset);
      mongoClients = await connectMongo(config);
      await resetMongo(mongoClients, dataset);
      await closeMongo(mongoClients);
      mongoClients = undefined;
      await resetPostgres(
        {
          auth: config.postgres.auth,
          recruiter: config.postgres.recruiter,
          engagement: config.postgres.engagement,
          rewards: config.postgres.rewards,
          analytics: config.postgres.analytics,
        },
        dataset,
      );
    }

    process.stdout.write('Seeding PostgreSQL stores...\n');
    const auth = await seedAuth(config.postgres, dataset, dataset.anchorMs);
    const recruiter = await seedRecruiter(config.postgres, dataset, dataset.anchorMs);
    const engagement = await seedEngagement(config.postgres, dataset, dataset.anchorMs);
    const rewards = await seedRewards(config.postgres, dataset, dataset.anchorMs);
    const analytics = await seedAnalytics(config.postgres, dataset, dataset.anchorMs);

    process.stdout.write('Seeding MongoDB projections...\n');
    mongoClients = await connectMongo(config);
    const mongo = await seedMongo(mongoClients, dataset);

    process.stdout.write('Seeding Qdrant vectors...\n');
    const qdrant = await seedQdrant(config.qdrant, dataset);

    let published = 0;
    if (options.publishEvents) {
      process.stdout.write('Publishing domain events to RabbitMQ...\n');
      published = await publishEvents(config.rabbitmq, dataset);
    }

    const result = { auth, recruiter, engagement, rewards, analytics, mongo, qdrant, published };

    process.stdout.write(
      [
        '',
        'Seed complete',
        formatCounts({
          users: auth.users,
          roles: auth.roles,
          organizations: recruiter.organizations,
          recruiterProfiles: recruiter.recruiters,
          jobs: recruiter.jobs,
          swipes: engagement.swipes,
          reviews: engagement.reviews,
          wallets: rewards.wallets,
          ledgerTransactions: rewards.ledgerTransactions,
          grants: rewards.grants,
          candidateMetrics: analytics.candidateMetrics,
          recruiterMetrics: analytics.recruiterMetrics,
          talentProfiles: mongo.talentProfiles,
          notifications: mongo.notifications,
          talentContacts: mongo.talentContacts,
          recruiterContacts: mongo.recruiterContacts,
          qdrantPoints: qdrant.points,
          publishedEvents: published,
        }),
        '',
        `Seeded account password: ${SEED_PASSWORD}`,
        `Synthetic email domain: ${EMAIL_SUFFIX}`,
        options.publishEvents
          ? 'Events were published to RabbitMQ.'
          : 'Events were not published (pass --publish to enable).',
        '',
      ].join('\n'),
    );

    return { summary, result };
  } finally {
    await closeMongo(mongoClients);
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run()
    .then((result) => {
      if (!result.help && !result.dryRun) {
        process.exitCode = 0;
      }
    })
    .catch((error) => {
      process.stderr.write(`\nSeeder failed: ${error instanceof Error ? error.message : error}\n`);
      process.exitCode = 1;
    });
}

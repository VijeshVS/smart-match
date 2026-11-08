import amqp from 'amqplib';
import { ObjectId } from 'mongodb';
import pg from 'pg';

import { SEED_PASSWORD_HASH, SEED_PASSWORD } from './data.js';
import { deterministicObjectId, deterministicUuid } from './random.js';

const { Pool } = pg;

const UPSERT_CHUNK_ROWS = 250;

const AUTH_ROLES = [
  {
    name: 'CANDIDATE',
    description: 'Candidate — owns and edits their talent profile.',
    permissions: ['talent:read', 'talent:write'],
  },
  {
    name: 'RECRUITER',
    description: 'Recruiter — discovers talent, reviews profiles and spends TalentCredits.',
    permissions: [
      'talent:read',
      'talent:unlock',
      'recruiter:read',
      'recruiter:write',
      'engagement:swipe',
      'engagement:review',
      'rewards:read',
      'rewards:spend',
      'analytics:read',
    ],
  },
  {
    name: 'ADMIN',
    description: 'Platform administrator — full access to every bounded context.',
    permissions: [
      'talent:read',
      'talent:write',
      'talent:unlock',
      'recruiter:read',
      'recruiter:write',
      'engagement:swipe',
      'engagement:review',
      'rewards:read',
      'rewards:spend',
      'analytics:read',
    ],
  },
];

/**
 * `pg` does not understand Prisma's `?schema=public` query parameter. The
 * generated Prisma clients keep the default schema, so stripping it is safe.
 */
export function normalizePostgresUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('schema');
    return parsed.toString();
  } catch {
    return url;
  }
}

function quote(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

/**
 * Generic multi-row upsert. `conflictColumns` must map to a primary key or a
 * unique constraint; every non-key column is refreshed from the incoming row so
 * repeated runs converge on the same state.
 */
export async function upsertRows(client, table, columns, rows, conflictColumns) {
  if (rows.length === 0) return 0;

  const conflictSet = new Set(conflictColumns);
  const updates = columns
    .filter((column) => !conflictSet.has(column))
    .map((column) => `${quote(column)} = EXCLUDED.${quote(column)}`);
  const conflictTarget = conflictColumns.map(quote).join(', ');
  const action = updates.length > 0 ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING';

  let written = 0;
  for (const batch of chunks(rows, UPSERT_CHUNK_ROWS)) {
    const values = [];
    const tuples = batch.map((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        values.push(row[column]);
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${placeholders.join(', ')})`;
    });

    await client.query(
      `INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES ${tuples.join(', ')} ON CONFLICT (${conflictTarget}) ${action}`,
      values,
    );
    written += batch.length;
  }

  return written;
}

async function withTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await operation(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function poolFor(url) {
  return new Pool({ connectionString: normalizePostgresUrl(url), max: 4 });
}

function at(value, fallback = new Date(value)) {
  return value instanceof Date ? value : fallback;
}

/* ────────────────────────────── Postgres ────────────────────────────── */

function authRows(dataset, anchor) {
  const now = new Date(anchor);

  const roles = AUTH_ROLES.map((role) => ({
    id: deterministicUuid(dataset.seed, `role:${role.name}`),
    name: role.name,
    description: role.description,
    permissions: JSON.stringify(role.permissions),
    created_at: now,
    updated_at: now,
  }));

  const users = [
    ...dataset.candidates.map((candidate) => ({
      id: candidate.userId,
      email: candidate.email,
      password_hash: SEED_PASSWORD_HASH,
      full_name: candidate.name,
      role: 'CANDIDATE',
      is_email_verified: true,
      is_active: true,
      last_login_at: null,
      created_at: at(candidate.createdAt, now),
      updated_at: at(candidate.updatedAt, now),
    })),
    ...dataset.recruiters.map((recruiter) => ({
      id: recruiter.userId,
      email: recruiter.email,
      password_hash: SEED_PASSWORD_HASH,
      full_name: recruiter.fullName,
      role: 'RECRUITER',
      is_email_verified: true,
      is_active: true,
      last_login_at: null,
      created_at: at(recruiter.createdAt, now),
      updated_at: at(recruiter.updatedAt, now),
    })),
  ];

  return { roles, users };
}

export async function seedAuth(config, dataset, anchor) {
  const pool = poolFor(config.auth);
  try {
    const { roles, users } = authRows(dataset, anchor);
    let counts = {};
    await withTransaction(pool, async (client) => {
      const rolesWritten = await upsertRows(
        client,
        'roles',
        ['id', 'name', 'description', 'permissions', 'created_at', 'updated_at'],
        roles,
        ['name'],
      );
      const usersWritten = await upsertRows(
        client,
        'users',
        [
          'id',
          'email',
          'password_hash',
          'full_name',
          'role',
          'is_email_verified',
          'is_active',
          'last_login_at',
          'created_at',
          'updated_at',
        ],
        users,
        ['id'],
      );
      counts = { roles: rolesWritten, users: usersWritten };
    });
    return counts;
  } finally {
    await pool.end();
  }
}

function recruiterRows(dataset, anchor) {
  const now = new Date(anchor);

  const organizations = dataset.organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    domain: organization.domain,
    website: organization.website,
    logo_url: organization.logoUrl,
    industry: organization.industry,
    size: organization.size,
    billing_email: organization.billingEmail,
    created_at: at(organization.createdAt, now),
    updated_at: at(organization.updatedAt, now),
  }));

  const recruiters = dataset.recruiters.map((recruiter) => ({
    id: recruiter.profileId,
    user_id: recruiter.userId,
    organization_id: recruiter.organizationId,
    full_name: recruiter.fullName,
    email: recruiter.email,
    title: recruiter.title,
    phone: recruiter.phone,
    permissions: recruiter.permissions,
    created_at: at(recruiter.createdAt, now),
    updated_at: at(recruiter.updatedAt, now),
  }));

  const jobs = dataset.jobs.map((job) => ({
    id: job.id,
    organization_id: job.organizationId,
    recruiter_id: job.recruiterProfileId,
    title: job.title,
    description: job.description,
    location: job.location,
    employment_type: job.employmentType,
    required_skills: job.requiredSkills,
    min_experience_years: job.minExperienceYears,
    max_experience_years: job.maxExperienceYears,
    status: job.status,
    created_at: at(job.createdAt, now),
    updated_at: at(job.updatedAt, now),
  }));

  return { organizations, recruiters, jobs };
}

export async function seedRecruiter(config, dataset, anchor) {
  const pool = poolFor(config.recruiter);
  try {
    const { organizations, recruiters, jobs } = recruiterRows(dataset, anchor);
    let counts = {};
    await withTransaction(pool, async (client) => {
      const organizationsWritten = await upsertRows(
        client,
        'organizations',
        [
          'id',
          'name',
          'domain',
          'website',
          'logo_url',
          'industry',
          'size',
          'billing_email',
          'created_at',
          'updated_at',
        ],
        organizations,
        ['id'],
      );
      const recruitersWritten = await upsertRows(
        client,
        'recruiter_profiles',
        [
          'id',
          'user_id',
          'organization_id',
          'full_name',
          'email',
          'title',
          'phone',
          'permissions',
          'created_at',
          'updated_at',
        ],
        recruiters,
        ['id'],
      );
      const jobsWritten = await upsertRows(
        client,
        'job_postings',
        [
          'id',
          'organization_id',
          'recruiter_id',
          'title',
          'description',
          'location',
          'employment_type',
          'required_skills',
          'min_experience_years',
          'max_experience_years',
          'status',
          'created_at',
          'updated_at',
        ],
        jobs,
        ['id'],
      );
      counts = {
        organizations: organizationsWritten,
        recruiters: recruitersWritten,
        jobs: jobsWritten,
      };
    });
    return counts;
  } finally {
    await pool.end();
  }
}

export async function seedEngagement(config, dataset, anchor) {
  const pool = poolFor(config.engagement);
  try {
    const now = new Date(anchor);
    const swipes = dataset.swipes.map((swipe) => ({
      id: swipe.id,
      recruiter_id: swipe.recruiterUserId,
      talent_id: swipe.talentId,
      decision: swipe.decision,
      created_at: at(swipe.createdAt, now),
      updated_at: at(swipe.updatedAt, now),
    }));
    const reviews = dataset.reviews.map((review) => ({
      id: review.id,
      swipe_id: review.swipeId,
      recruiter_id: review.recruiterUserId,
      talent_id: review.talentId,
      decision: review.decision,
      rating: review.rating,
      feedback_text: review.feedbackText,
      actionable_advice: review.actionableAdvice ?? null,
      has_actionable_feedback: review.hasActionableFeedback,
      created_at: at(review.createdAt, now),
      updated_at: at(review.updatedAt, now),
    }));

    let counts = {};
    await withTransaction(pool, async (client) => {
      const swipesWritten = await upsertRows(
        client,
        'swipes',
        ['id', 'recruiter_id', 'talent_id', 'decision', 'created_at', 'updated_at'],
        swipes,
        ['id'],
      );
      const reviewsWritten = await upsertRows(
        client,
        'reviews',
        [
          'id',
          'swipe_id',
          'recruiter_id',
          'talent_id',
          'decision',
          'rating',
          'feedback_text',
          'actionable_advice',
          'has_actionable_feedback',
          'created_at',
          'updated_at',
        ],
        reviews,
        ['id'],
      );
      counts = { swipes: swipesWritten, reviews: reviewsWritten };
    });
    return counts;
  } finally {
    await pool.end();
  }
}

export async function seedRewards(config, dataset, anchor) {
  const pool = poolFor(config.rewards);
  try {
    const now = new Date(anchor);
    const wallets = dataset.wallets.map((wallet) => ({
      id: wallet.id,
      recruiter_id: wallet.recruiterUserId,
      balance: wallet.balance,
      version: wallet.version,
      created_at: at(wallet.createdAt, now),
      updated_at: at(wallet.updatedAt, now),
    }));
    const ledger = dataset.ledgerTransactions.map((transaction) => ({
      id: transaction.id,
      wallet_id: transaction.walletId,
      amount: transaction.amount,
      type: transaction.type,
      reference_id: transaction.referenceId,
      description: transaction.description,
      balance_after: transaction.balanceAfter,
      created_at: at(transaction.createdAt, now),
    }));
    const grants = dataset.grants.map((grant) => ({
      id: grant.id,
      recruiter_id: grant.recruiterUserId,
      talent_id: grant.talentId,
      tier_unlocked: grant.tierUnlocked,
      expires_at: grant.expiresAt ?? null,
      created_at: at(grant.createdAt, now),
    }));

    let counts = {};
    await withTransaction(pool, async (client) => {
      const walletsWritten = await upsertRows(
        client,
        'wallets',
        ['id', 'recruiter_id', 'balance', 'version', 'created_at', 'updated_at'],
        wallets,
        ['id'],
      );
      const ledgerWritten = await upsertRows(
        client,
        'ledger_transactions',
        [
          'id',
          'wallet_id',
          'amount',
          'type',
          'reference_id',
          'description',
          'balance_after',
          'created_at',
        ],
        ledger,
        ['id'],
      );
      const grantsWritten = await upsertRows(
        client,
        'talent_access_grants',
        ['id', 'recruiter_id', 'talent_id', 'tier_unlocked', 'expires_at', 'created_at'],
        grants,
        ['id'],
      );
      counts = {
        wallets: walletsWritten,
        ledgerTransactions: ledgerWritten,
        grants: grantsWritten,
      };
    });
    return counts;
  } finally {
    await pool.end();
  }
}

export async function seedAnalytics(config, dataset, anchor) {
  const pool = poolFor(config.analytics);
  try {
    const now = new Date(anchor);
    const { analytics } = dataset;

    const candidateMetrics = analytics.candidateMetrics.map((metric) => ({
      talent_id: metric.talentId,
      user_id: metric.userId,
      right_swipes: metric.rightSwipes,
      left_swipes: metric.leftSwipes,
      total_reviews: metric.totalReviews,
      profile_created_at: at(metric.profileCreatedAt, now),
      first_approved_at: metric.firstApprovedAt ? at(metric.firstApprovedAt, now) : null,
      updated_at: now,
    }));

    const recruiterIdentities = analytics.recruiterIdentities.map((identity) => ({
      profile_id: identity.profileId,
      user_id: identity.userId,
      organization_id: identity.organizationId,
      updated_at: now,
    }));

    const recruiterMetrics = analytics.recruiterMetrics.map((metric) => ({
      recruiter_id: metric.recruiterId,
      organization_id: metric.organizationId,
      open_jobs: metric.openJobs,
      reviews_submitted: metric.reviewsSubmitted,
      actionable_feedback_count: metric.actionableFeedbackCount,
      credits_earned: metric.creditsEarned,
      approvals: metric.approvals,
      rejections: metric.rejections,
      match_count: metric.matchCount,
      match_delay_ms_sum: metric.matchDelayMsSum,
      updated_at: now,
    }));

    const skillMetrics = analytics.skillMetrics.map((metric) => ({
      skill: metric.skill,
      demand_count: metric.demandCount,
      supply_count: metric.supplyCount,
      experience_sum: metric.experienceSum,
      experience_count: metric.experienceCount,
      updated_at: now,
    }));

    const recruiterSkillDemands = analytics.recruiterSkillDemands.map((demand) => ({
      recruiter_id: demand.recruiterId,
      skill: demand.skill,
      job_count: demand.jobCount,
      updated_at: now,
    }));

    const candidateSkills = analytics.candidateSkills.map((skill) => ({
      talent_id: skill.talentId,
      skill: skill.skill,
      experience_years: skill.experienceYears,
      updated_at: now,
    }));

    const funnelAggregates = analytics.funnelAggregates.map((aggregate) => ({
      day: aggregate.day,
      profiles_created: aggregate.profilesCreated,
      swipes_recorded: aggregate.swipesRecorded,
      reviews_submitted: aggregate.reviewsSubmitted,
      tier3_unlocks: aggregate.tier3Unlocks,
      approvals: aggregate.approvals,
      updated_at: now,
    }));

    const processedEvents = analytics.processedEvents.map((event) => ({
      event_id: event.eventId,
      event_type: event.eventType,
      processed_at: at(event.processedAt, now),
    }));

    let counts = {};
    await withTransaction(pool, async (client) => {
      const candidateMetricsWritten = await upsertRows(
        client,
        'candidate_metrics',
        [
          'talent_id',
          'user_id',
          'right_swipes',
          'left_swipes',
          'total_reviews',
          'profile_created_at',
          'first_approved_at',
          'updated_at',
        ],
        candidateMetrics,
        ['talent_id'],
      );
      const identitiesWritten = await upsertRows(
        client,
        'recruiter_identities',
        ['profile_id', 'user_id', 'organization_id', 'updated_at'],
        recruiterIdentities,
        ['profile_id'],
      );
      const recruiterMetricsWritten = await upsertRows(
        client,
        'recruiter_metrics',
        [
          'recruiter_id',
          'organization_id',
          'open_jobs',
          'reviews_submitted',
          'actionable_feedback_count',
          'credits_earned',
          'approvals',
          'rejections',
          'match_count',
          'match_delay_ms_sum',
          'updated_at',
        ],
        recruiterMetrics,
        ['recruiter_id'],
      );
      const skillMetricsWritten = await upsertRows(
        client,
        'skill_metrics',
        [
          'skill',
          'demand_count',
          'supply_count',
          'experience_sum',
          'experience_count',
          'updated_at',
        ],
        skillMetrics,
        ['skill'],
      );
      const recruiterSkillDemandsWritten = await upsertRows(
        client,
        'recruiter_skill_demands',
        ['recruiter_id', 'skill', 'job_count', 'updated_at'],
        recruiterSkillDemands,
        ['recruiter_id', 'skill'],
      );
      const candidateSkillsWritten = await upsertRows(
        client,
        'candidate_skills',
        ['talent_id', 'skill', 'experience_years', 'updated_at'],
        candidateSkills,
        ['talent_id', 'skill'],
      );
      const funnelWritten = await upsertRows(
        client,
        'funnel_aggregates',
        [
          'day',
          'profiles_created',
          'swipes_recorded',
          'reviews_submitted',
          'tier3_unlocks',
          'approvals',
          'updated_at',
        ],
        funnelAggregates,
        ['day'],
      );
      const processedWritten = await upsertRows(
        client,
        'processed_events',
        ['event_id', 'event_type', 'processed_at'],
        processedEvents,
        ['event_id'],
      );

      counts = {
        candidateMetrics: candidateMetricsWritten,
        recruiterIdentities: identitiesWritten,
        recruiterMetrics: recruiterMetricsWritten,
        skillMetrics: skillMetricsWritten,
        recruiterSkillDemands: recruiterSkillDemandsWritten,
        candidateSkills: candidateSkillsWritten,
        funnelAggregates: funnelWritten,
        processedEvents: processedWritten,
      };
    });
    return counts;
  } finally {
    await pool.end();
  }
}

/* ──────────────────────────── Reset (Postgres) ───────────────────────── */

export async function resetPostgres(config, dataset) {
  const candidateIds = dataset.candidates.map((candidate) => candidate.talentId);
  const candidateUserIds = dataset.candidates.map((candidate) => candidate.userId);
  const recruiterUserIds = dataset.recruiters.map((recruiter) => recruiter.userId);
  const recruiterProfileIds = dataset.recruiters.map((recruiter) => recruiter.profileId);
  const organizationIds = dataset.organizations.map((organization) => organization.id);
  const jobIds = dataset.jobs.map((job) => job.id);
  const swipeIds = dataset.swipes.map((swipe) => swipe.id);
  const reviewIds = dataset.reviews.map((review) => review.id);
  const walletIds = dataset.wallets.map((wallet) => wallet.id);
  const grantIds = dataset.grants.map((grant) => grant.id);
  const ledgerIds = dataset.ledgerTransactions.map((transaction) => transaction.id);
  const eventIds = dataset.events.map((event) => event.eventId);
  const skills = [...new Set(dataset.analytics.skillMetrics.map((metric) => metric.skill))];
  const days = dataset.analytics.funnelAggregates.map((aggregate) => aggregate.day);

  const run = async (url, statements) => {
    const pool = poolFor(url);
    try {
      await withTransaction(pool, async (client) => {
        for (const [query, params] of statements) {
          await client.query(query, params);
        }
      });
    } finally {
      await pool.end();
    }
  };

  await run(config.engagement, [
    ['DELETE FROM "reviews" WHERE "talent_id" = ANY($1::uuid[])', [candidateIds]],
    ['DELETE FROM "swipes" WHERE "talent_id" = ANY($1::uuid[])', [candidateIds]],
    ['DELETE FROM "reviews" WHERE "recruiter_id" = ANY($1::uuid[])', [recruiterUserIds]],
    ['DELETE FROM "swipes" WHERE "recruiter_id" = ANY($1::uuid[])', [recruiterUserIds]],
    ['DELETE FROM "reviews" WHERE "id" = ANY($1::uuid[])', [reviewIds]],
    ['DELETE FROM "swipes" WHERE "id" = ANY($1::uuid[])', [swipeIds]],
  ]);

  await run(config.rewards, [
    ['DELETE FROM "ledger_transactions" WHERE "id" = ANY($1::uuid[])', [ledgerIds]],
    [
      'DELETE FROM "ledger_transactions" WHERE "wallet_id" = ANY($1::uuid[])',
      [walletIds],
    ],
    [
      'DELETE FROM "talent_access_grants" WHERE "talent_id" = ANY($1::uuid[])',
      [candidateIds],
    ],
    [
      'DELETE FROM "talent_access_grants" WHERE "recruiter_id" = ANY($1::uuid[])',
      [recruiterUserIds],
    ],
    ['DELETE FROM "talent_access_grants" WHERE "id" = ANY($1::uuid[])', [grantIds]],
    ['DELETE FROM "wallets" WHERE "recruiter_id" = ANY($1::uuid[])', [recruiterUserIds]],
    ['DELETE FROM "wallets" WHERE "id" = ANY($1::uuid[])', [walletIds]],
  ]);

  await run(config.analytics, [
    ['DELETE FROM "candidate_metrics" WHERE "talent_id" = ANY($1::uuid[])', [candidateIds]],
    ['DELETE FROM "candidate_skills" WHERE "talent_id" = ANY($1::uuid[])', [candidateIds]],
    ['DELETE FROM "recruiter_metrics" WHERE "recruiter_id" = ANY($1::uuid[])', [recruiterUserIds]],
    [
      'DELETE FROM "recruiter_identities" WHERE "user_id" = ANY($1::uuid[])',
      [recruiterUserIds],
    ],
    [
      'DELETE FROM "recruiter_identities" WHERE "profile_id" = ANY($1::uuid[])',
      [recruiterProfileIds],
    ],
    [
      'DELETE FROM "recruiter_skill_demands" WHERE "recruiter_id" = ANY($1::uuid[])',
      [recruiterUserIds],
    ],
    ['DELETE FROM "skill_metrics" WHERE "skill" = ANY($1::varchar[])', [skills]],
    ['DELETE FROM "funnel_aggregates" WHERE "day" = ANY($1::date[])', [days]],
    ['DELETE FROM "processed_events" WHERE "event_id" = ANY($1::varchar[])', [eventIds]],
  ]);

  await run(config.recruiter, [
    ['DELETE FROM "job_postings" WHERE "id" = ANY($1::uuid[])', [jobIds]],
    [
      'DELETE FROM "job_postings" WHERE "organization_id" = ANY($1::uuid[])',
      [organizationIds],
    ],
    [
      'DELETE FROM "job_postings" WHERE "recruiter_id" = ANY($1::uuid[])',
      [recruiterProfileIds],
    ],
    ['DELETE FROM "recruiter_profiles" WHERE "id" = ANY($1::uuid[])', [recruiterProfileIds]],
    ['DELETE FROM "organizations" WHERE "id" = ANY($1::uuid[])', [organizationIds]],
  ]);

  await run(config.auth, [
    ['DELETE FROM "users" WHERE "id" = ANY($1::uuid[])', [candidateUserIds]],
    ['DELETE FROM "users" WHERE "id" = ANY($1::uuid[])', [recruiterUserIds]],
  ]);
}

/* ──────────────────────────────── Mongo ─────────────────────────────── */

function mongoDate(value) {
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function talentProfileDocuments(dataset) {
  return dataset.candidates.map((candidate) => ({
    _id: candidate.talentId,
    userId: candidate.userId,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    field: candidate.field,
    skills: [...candidate.skills],
    experienceYears: candidate.experienceYears,
    education: candidate.education,
    previousExperience: candidate.previousExperience.map((entry) => ({
      ...entry,
      startDate: entry.startDate ? mongoDate(entry.startDate) : undefined,
      endDate: entry.endDate ? mongoDate(entry.endDate) : undefined,
    })),
    level: candidate.level,
    bio: candidate.bio,
    createdAt: mongoDate(candidate.createdAt),
    updatedAt: mongoDate(candidate.updatedAt),
  }));
}

export function notificationDocuments(dataset) {
  return dataset.notifications.map((notification) => ({
    _id: new ObjectId(notification.id),
    eventId: notification.eventId,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    read: notification.read,
    deliveryStatus: notification.deliveryStatus,
    emailStatus: notification.emailStatus,
    createdAt: mongoDate(notification.createdAt),
    updatedAt: mongoDate(notification.createdAt),
  }));
}

export function talentContactDocuments(dataset) {
  return dataset.candidates.map((candidate) => ({
    _id: new ObjectId(deterministicObjectId(dataset.seed, `contact:talent:${candidate.talentId}`)),
    talentId: candidate.talentId,
    userId: candidate.userId,
    name: candidate.name,
    email: candidate.email,
    updatedAt: mongoDate(candidate.updatedAt),
  }));
}

export function recruiterContactDocuments(dataset) {
  return dataset.recruiters.map((recruiter) => ({
    _id: new ObjectId(
      deterministicObjectId(dataset.seed, `contact:recruiter:${recruiter.profileId}`),
    ),
    recruiterId: recruiter.profileId,
    userId: recruiter.userId,
    organizationId: recruiter.organizationId,
    email: recruiter.email,
    updatedAt: mongoDate(recruiter.updatedAt),
  }));
}

async function replaceAll(database, collection, documents, key) {
  for (const batch of chunks(documents, 200)) {
    const operations = batch.map((document) => ({
      replaceOne: {
        filter: { [key]: document[key] },
        replacement: document,
        upsert: true,
      },
    }));
    await database.collection(collection).bulkWrite(operations, { ordered: false });
  }
  return documents.length;
}

export async function seedMongo(clients, dataset) {
  const talent = clients.talent.client.db(clients.talent.dbName);
  const notification = clients.notification.client.db(clients.notification.dbName);

  return {
    talentProfiles: await replaceAll(
      talent,
      'talent_profiles',
      talentProfileDocuments(dataset),
      '_id',
    ),
    notifications: await replaceAll(
      notification,
      'notifications',
      notificationDocuments(dataset),
      '_id',
    ),
    talentContacts: await replaceAll(
      notification,
      'talent_contacts',
      talentContactDocuments(dataset),
      'talentId',
    ),
    recruiterContacts: await replaceAll(
      notification,
      'recruiter_contacts',
      recruiterContactDocuments(dataset),
      'userId',
    ),
  };
}

export async function resetMongo(clients, dataset) {
  const talent = clients.talent.client.db(clients.talent.dbName);
  const notification = clients.notification.client.db(clients.notification.dbName);

  const candidateIds = dataset.candidates.map((candidate) => candidate.talentId);
  const candidateUserIds = dataset.candidates.map((candidate) => candidate.userId);
  const recruiterUserIds = dataset.recruiters.map((recruiter) => recruiter.userId);
  const recruiterProfileIds = dataset.recruiters.map((recruiter) => recruiter.profileId);
  const notificationIds = dataset.notifications.map(
    (notificationEntry) => new ObjectId(notificationEntry.id),
  );

  await talent.collection('talent_profiles').deleteMany({ _id: { $in: candidateIds } });
  await notification.collection('notifications').deleteMany({ _id: { $in: notificationIds } });
  await notification
    .collection('notifications')
    .deleteMany({ userId: { $in: [...candidateUserIds, ...recruiterUserIds] } });
  await notification.collection('talent_contacts').deleteMany({ talentId: { $in: candidateIds } });
  await notification
    .collection('recruiter_contacts')
    .deleteMany({ $or: [{ userId: { $in: recruiterUserIds } }, { recruiterId: { $in: recruiterProfileIds } }] });
}

/* ──────────────────────────────── Qdrant ─────────────────────────────── */

export async function qdrantRequest(config, method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (config.apiKey) headers['api-key'] = config.apiKey;

  const response = await fetch(`${config.url}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const error = new Error(
      `Qdrant ${method} ${path} failed (${response.status}): ${text.slice(0, 300)}`,
    );
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

const QDRANT_INDEXES = [
  { field_name: 'talentId', field_schema: 'keyword' },
  { field_name: 'level', field_schema: 'keyword' },
  { field_name: 'fieldLower', field_schema: 'keyword' },
  { field_name: 'skillsLower', field_schema: 'keyword' },
  { field_name: 'experienceYears', field_schema: 'integer' },
];

export async function ensureQdrantCollection(config) {
  try {
    const existing = await qdrantRequest(
      config,
      'GET',
      `/collections/${encodeURIComponent(config.collection)}`,
    );
    const size = existing?.result?.config?.params?.vectors?.size;
    if (typeof size === 'number' && size !== config.dimensions) {
      throw new Error(
        `Qdrant collection ${config.collection} has dimension ${size}, expected ${config.dimensions}`,
      );
    }
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    await qdrantRequest(config, 'PUT', `/collections/${encodeURIComponent(config.collection)}`, {
      vectors: { size: config.dimensions, distance: 'Cosine' },
      on_disk_payload: true,
    });
  }

  for (const index of QDRANT_INDEXES) {
    try {
      await qdrantRequest(
        config,
        'PUT',
        `/collections/${encodeURIComponent(config.collection)}/index`,
        index,
      );
    } catch (error) {
      // Existing indexes return 409; payload indexes are an optimisation.
      if (![400, 409].includes(error.statusCode)) throw error;
    }
  }
}

export async function seedQdrant(config, dataset) {
  await ensureQdrantCollection(config);

  const points = dataset.candidates.map((candidate, index) => {
    const point = dataset.qdrantPoints[index];
    return { id: point.id, vector: point.vector, payload: point.payload };
  });

  for (const batch of chunks(points, 100)) {
    await qdrantRequest(
      config,
      'PUT',
      `/collections/${encodeURIComponent(config.collection)}/points?wait=true`,
      { points: batch },
    );
  }

  return { points: points.length };
}

export async function resetQdrant(config, dataset) {
  const ids = dataset.qdrantPoints.map((point) => point.id);
  try {
    await qdrantRequest(
      config,
      'POST',
      `/collections/${encodeURIComponent(config.collection)}/points/delete?wait=true`,
      { points: ids },
    );
  } catch (error) {
    if (error.statusCode === 404) return;
    throw error;
  }
}

/* ────────────────────────────── RabbitMQ ───────────────────────────── */

export async function publishEvents(config, dataset) {
  if (dataset.events.length === 0) return 0;

  const connection = await amqp.connect(config.url);
  try {
    const channel = await connection.createConfirmChannel();
    try {
      await channel.assertExchange(config.exchange, 'topic', { durable: true });
      for (const event of dataset.events) {
        const body = Buffer.from(JSON.stringify(event), 'utf8');
        await new Promise((resolve, reject) => {
          channel.publish(
            config.exchange,
            event.eventType,
            body,
            {
              persistent: true,
              contentType: 'application/json',
              contentEncoding: 'utf-8',
              messageId: event.eventId,
              timestamp: Math.floor(new Date(event.timestamp).getTime() / 1_000),
              type: event.eventType,
              appId: 'realistic-seeder',
              correlationId: event.correlationId,
              headers: {
                eventId: event.eventId,
                eventType: event.eventType,
                aggregateId: event.aggregateId,
                correlationId: event.correlationId,
                version: event.version,
              },
            },
            (error) => (error ? reject(error) : resolve()),
          );
        });
      }
    } finally {
      await channel.close().catch(() => undefined);
    }
  } finally {
    await connection.close().catch(() => undefined);
  }

  return dataset.events.length;
}

export const SEED_CREDENTIALS = {
  password: SEED_PASSWORD,
  passwordHash: SEED_PASSWORD_HASH,
};

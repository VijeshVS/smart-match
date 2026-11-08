import { buildEmbeddingText, localEmbedding } from './embedding.js';
import { createRng, deterministicObjectId, deterministicUuid, toPointId } from './random.js';

/** Fixed argon2id hash for `TalentSeed!2026` (documented in the seeder README). */
export const SEED_PASSWORD = 'TalentSeed!2026';
export const SEED_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$FEGnrHKDzwXcxsihs+/eBQ$0V5M3xIDrlb7bjiA2Etz0Lf9ZDb877sRjVdiy+GRl9Y';

const DAY_MS = 86_400_000;

const FIRST_NAMES = [
  'Aarav',
  'Aditi',
  'Aisha',
  'Arjun',
  'Bianca',
  'Chen',
  'Daniela',
  'Dev',
  'Elena',
  'Farah',
  'Gabriel',
  'Hana',
  'Ibrahim',
  'Ishaan',
  'Jia',
  'Kavya',
  'Liam',
  'Maya',
  'Meera',
  'Nikhil',
  'Noah',
  'Priya',
  'Rafael',
  'Riya',
  'Sakura',
  'Sara',
  'Tariq',
  'Vikram',
  'Yara',
  'Zoe',
];

const LAST_NAMES = [
  'Agarwal',
  'Bhat',
  'Chen',
  'D Costa',
  'Desai',
  'Dubois',
  'Fernandes',
  'Gupta',
  'Haddad',
  'Iyer',
  'Joshi',
  'Khan',
  'Kim',
  'Kulkarni',
  'Lee',
  'Mehta',
  'Menon',
  'Nair',
  'Okafor',
  'Patel',
  'Rao',
  'Reddy',
  'Rossi',
  'Sato',
  'Shah',
  'Singh',
  'Tanaka',
  'Verma',
  'Wang',
  'Yilmaz',
];

const FIELDS = [
  'Backend Engineering',
  'Frontend Engineering',
  'Data Engineering',
  'Machine Learning',
  'Platform Engineering',
  'Product Management',
  'Product Design',
  'Mobile Engineering',
  'Security Engineering',
  'Quality Engineering',
];

const SKILLS_BY_FIELD = {
  'Backend Engineering': ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'RabbitMQ', 'REST', 'gRPC', 'Go'],
  'Frontend Engineering': ['React', 'TypeScript', 'Next.js', 'CSS', 'Accessibility', 'Vite', 'Testing Library', 'React Native'],
  'Data Engineering': ['Python', 'SQL', 'Airflow', 'dbt', 'Spark', 'Kafka', 'PostgreSQL', 'Data Modeling'],
  'Machine Learning': ['Python', 'PyTorch', 'scikit-learn', 'NLP', 'MLOps', 'Vector Search', 'Pandas', 'LLMs'],
  'Platform Engineering': ['Kubernetes', 'Terraform', 'Docker', 'AWS', 'Linux', 'Prometheus', 'Grafana', 'CI/CD'],
  'Product Management': ['Roadmapping', 'Analytics', 'User Research', 'SQL', 'Experimentation', 'Stakeholder Management', 'Agile'],
  'Product Design': ['Figma', 'Design Systems', 'Prototyping', 'User Research', 'Accessibility', 'Interaction Design'],
  'Mobile Engineering': ['React Native', 'Swift', 'Kotlin', 'Firebase', 'Mobile UI', 'REST', 'App Store Deployment'],
  'Security Engineering': ['Threat Modeling', 'OAuth', 'OWASP', 'Penetration Testing', 'Cloud Security', 'Cryptography', 'SIEM'],
  'Quality Engineering': ['Playwright', 'Cypress', 'Jest', 'Test Strategy', 'API Testing', 'CI/CD', 'Performance Testing'],
};

const COMPANIES = [
  'Northwind Labs',
  'Lumen Systems',
  'Bluepeak Software',
  'Orbit Foundry',
  'Cedar Stack',
  'Juniper Works',
  'Quartzline',
  'Helio Commerce',
  'Maple Circuit',
  'Vertex Grove',
  'Pinecrest Digital',
  'Summit Relay',
];

const COLLEGES = [
  'Synthetic Institute of Technology',
  'Northbridge University',
  'Lakeview Institute',
  'Pinecrest University',
  'Riverstone College',
  'Harborview Technical University',
];

const DEGREES = ['B.Tech', 'B.E.', 'B.Sc', 'M.Tech', 'M.Sc', 'MBA'];
const BRANCHES = [
  'Computer Science',
  'Information Technology',
  'Electronics',
  'Data Science',
  'Information Systems',
  'Human-Computer Interaction',
];
const LOCATIONS = ['Bengaluru', 'Pune', 'Hyderabad', 'Remote', 'Berlin', 'Singapore', 'Toronto'];
const EMPLOYMENT_TYPES = ['FULL_TIME', 'FULL_TIME', 'FULL_TIME', 'CONTRACT', 'PART_TIME', 'INTERNSHIP'];
const JOB_STATUSES = ['OPEN', 'OPEN', 'OPEN', 'OPEN', 'CLOSED', 'DRAFT'];
const RECRUITER_TITLES = [
  'Talent Partner',
  'Senior Recruiter',
  'Engineering Recruiter',
  'Head of Talent',
  'Technical Sourcer',
];
const RECRUITER_PERMISSIONS = [
  'talent:read',
  'talent:unlock',
  'recruiter:read',
  'recruiter:write',
  'engagement:swipe',
  'engagement:review',
  'rewards:read',
  'rewards:spend',
  'analytics:read',
];
const HEALTHCARE = ['Backend Engineering', 'Data Engineering', 'Machine Learning'];

const FEEDBACK = [
  'Solid fundamentals and clear communication.',
  'Strong systems thinking; could go deeper on testing.',
  'Good product sense and concise examples.',
  'Promising profile, but the impact metrics were vague.',
  'Excellent depth in the primary stack.',
  'Would benefit from more cross-functional examples.',
];

const ADVICE = [
  'Add concrete latency or scale numbers to at least one project.',
  'Describe the trade-offs behind the architecture you chose.',
  'Include a short section on testing and observability.',
  'Quantify the business impact of the migration you led.',
  'Link a public repository or case study for the main project.',
];

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function clampDate(date, maxMs) {
  return new Date(Math.min(date.getTime(), maxMs));
}

function levelForYears(years) {
  if (years < 2) return 'LEVEL_1_ENTRY';
  if (years < 6) return 'LEVEL_2_MID';
  return 'LEVEL_3_LEAD';
}

function iso(date) {
  return date.toISOString();
}

function utcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildCandidate(rng, seed, index, anchorMs) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 7 + 3) % LAST_NAMES.length];
  const field = FIELDS[index % FIELDS.length];
  const pool = SKILLS_BY_FIELD[field];
  const skills = rng.pickMany(pool, rng.int(4, Math.min(8, pool.length)));
  const experienceYears = rng.int(0, 17);
  const level = levelForYears(experienceYears);
  const talentId = deterministicUuid(seed, `talent:${index}`);
  const userId = deterministicUuid(seed, `user:candidate:${index}`);
  const createdDaysAgo = rng.int(8, 55);
  const createdAt = new Date(anchorMs - createdDaysAgo * DAY_MS - rng.int(0, 23) * 3_600_000);
  const updatedAt = clampDate(
    new Date(createdAt.getTime() + rng.int(0, Math.min(10, createdDaysAgo)) * DAY_MS),
    anchorMs,
  );

  const educationCount = rng.int(1, 2);
  const education = Array.from({ length: educationCount }, (_, entry) => ({
    college: COLLEGES[(index + entry) % COLLEGES.length],
    degree: DEGREES[(index + entry) % DEGREES.length],
    branchOfStudy: BRANCHES[(index + entry * 2) % BRANCHES.length],
    yearOfGraduation: Math.min(
      2026,
      Math.max(2004, 2026 - Math.floor(experienceYears / 2) - entry),
    ),
    gpa: Number(rng.float(6.4, 9.6).toFixed(2)),
  }));

  const experienceCount = Math.min(3, Math.floor(experienceYears / 3));
  const previousExperience = Array.from({ length: experienceCount }, (_, entry) => {
    const durationMonths = rng.int(8, 42);
    const startDate = new Date(
      createdAt.getTime() - (experienceCount - entry) * 18 * 30 * DAY_MS,
    );
    const endDate = new Date(startDate.getTime() + durationMonths * 30 * DAY_MS);
    return {
      company: COMPANIES[(index + entry * 3) % COMPANIES.length],
      role: `${['Software Engineer', 'Senior Engineer', 'Lead Engineer', 'Data Scientist'][entry % 4]}`,
      durationMonths,
      responsibilities: rng.pickMany(
        [
          'Owned a service used by internal teams.',
          'Improved release automation and test coverage.',
          'Built dashboards for operational visibility.',
          'Reduced p95 latency on a critical API.',
          'Partnered with product on discovery and delivery.',
        ],
        rng.int(2, 3),
      ),
      startDate: iso(startDate),
      endDate: iso(endDate),
    };
  });

  return {
    talentId,
    userId,
    name: `${first} ${last}`,
    email: `candidate.${index}.${slug(first)}.${slug(last)}@synthetic.talent.test`,
    phone: `+1-555-01${String(index).padStart(2, '0')}`,
    field,
    skills,
    experienceYears,
    level,
    education,
    previousExperience,
    bio: `${first} is a ${level === 'LEVEL_3_LEAD' ? 'senior' : level === 'LEVEL_2_MID' ? 'mid-level' : 'junior'} ${field.toLowerCase()} professional focused on ${skills.slice(0, 3).join(', ')}.`,
    createdAt,
    updatedAt,
  };
}

function buildRecruiter(rng, seed, index, organizationId, organizationName, anchorMs) {
  const first = FIRST_NAMES[(index * 5 + 2) % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 11 + 1) % LAST_NAMES.length];
  const createdAt = new Date(anchorMs - rng.int(20, 70) * DAY_MS - rng.int(0, 23) * 3_600_000);

  return {
    profileId: deterministicUuid(seed, `recruiter:${index}`),
    userId: deterministicUuid(seed, `user:recruiter:${index}`),
    organizationId,
    organizationName,
    fullName: `${first} ${last}`,
    email: `recruiter.${index}.${slug(first)}.${slug(last)}@synthetic.talent.test`,
    title: RECRUITER_TITLES[index % RECRUITER_TITLES.length],
    phone: `+1-555-02${String(index).padStart(2, '0')}`,
    permissions: [...RECRUITER_PERMISSIONS],
    createdAt,
    updatedAt: new Date(createdAt.getTime() + rng.int(0, 10) * DAY_MS),
  };
}

function buildOrganization(rng, seed, index, anchorMs) {
  const name = `${COMPANIES[index % COMPANIES.length]} ${['Labs', 'Systems', 'Group', 'Holdings'][index % 4]}`;
  return {
    id: deterministicUuid(seed, `org:${index}`),
    name,
    domain: `company-${index}.synthetic.talent.test`,
    website: `https://company-${index}.synthetic.talent.test`,
    logoUrl: `https://company-${index}.synthetic.talent.test/logo.svg`,
    industry: ['Software', 'Fintech', 'Healthcare', 'Commerce'][index % 4],
    size: ['51-200', '201-500', '501-1000', '1000+'][index % 4],
    billingEmail: `billing@company-${index}.synthetic.talent.test`,
    createdAt: new Date(anchorMs - rng.int(90, 180) * DAY_MS),
    updatedAt: new Date(anchorMs - rng.int(1, 30) * DAY_MS),
  };
}

function buildJob(rng, seed, index, recruiter, anchorMs) {
  const field = FIELDS[(index * 3) % FIELDS.length];
  const pool = SKILLS_BY_FIELD[field];
  const requiredSkills = rng.pickMany(pool, rng.int(3, Math.min(6, pool.length)));
  const minExperienceYears = rng.int(0, 8);
  const createdAt = new Date(
    Math.max(
      recruiter.createdAt.getTime(),
      anchorMs - rng.int(1, 30) * DAY_MS - rng.int(0, 23) * 3_600_000,
    ),
  );

  return {
    id: deterministicUuid(seed, `job:${index}`),
    organizationId: recruiter.organizationId,
    recruiterProfileId: recruiter.profileId,
    title: `${['Junior', 'Mid-level', 'Senior', 'Staff'][index % 4]} ${field.replace(' Engineering', ' Engineer')}`,
    description: `Synthetic ${field.toLowerCase()} role generated for talent.ai Phase 11 observability. The team is hiring for ${requiredSkills.join(', ')}.`,
    location: LOCATIONS[index % LOCATIONS.length],
    employmentType: EMPLOYMENT_TYPES[index % EMPLOYMENT_TYPES.length],
    requiredSkills,
    minExperienceYears,
    maxExperienceYears: minExperienceYears + rng.int(2, 6),
    status: JOB_STATUSES[index % JOB_STATUSES.length],
    createdAt,
    updatedAt: new Date(createdAt.getTime() + rng.int(0, 5) * DAY_MS),
  };
}

function buildSwipes(rng, seed, candidates, recruiters, anchorMs) {
  const swipes = [];
  const maxMs = anchorMs - 3_600_000;

  candidates.forEach((candidate, index) => {
    // Keep a slice of candidates at the top of the funnel with no swipe yet.
    if (index % 7 === 6) return;

    const count = rng.int(1, Math.min(3, recruiters.length));
    const selected = rng.shuffle(recruiters).slice(0, count);

    for (const recruiter of selected) {
      const roll = rng.next();
      const decision = roll < 0.45 ? 'APPROVE' : roll < 0.85 ? 'REJECT' : 'DEFER';
      const createdAt = clampDate(
        new Date(
          Math.max(
            candidate.createdAt.getTime(),
            recruiter.createdAt.getTime(),
          ) + rng.int(1, 18) * DAY_MS,
        ),
        maxMs,
      );

      swipes.push({
        id: deterministicUuid(seed, `swipe:${recruiter.userId}:${candidate.talentId}`),
        recruiterProfileId: recruiter.profileId,
        recruiterUserId: recruiter.userId,
        talentId: candidate.talentId,
        decision,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + rng.int(0, 6) * 3_600_000),
      });
    }
  });

  return swipes.sort((left, right) => left.createdAt - right.createdAt);
}

function buildReviews(rng, seed, swipes) {
  return swipes
    .filter((swipe) => {
      if (swipe.decision === 'DEFER') return rng.bool(0.15);
      return rng.bool(swipe.decision === 'APPROVE' ? 0.72 : 0.5);
    })
    .map((swipe) => {
      const hasActionableFeedback = rng.bool(0.62);
      const actionableAdvice = hasActionableFeedback ? rng.pick(ADVICE) : undefined;
      const createdAt = new Date(swipe.createdAt.getTime() + rng.int(1, 72) * 3_600_000);
      return {
        id: deterministicUuid(seed, `review:${swipe.id}`),
        swipeId: swipe.id,
        recruiterProfileId: swipe.recruiterProfileId,
        recruiterUserId: swipe.recruiterUserId,
        talentId: swipe.talentId,
        decision: swipe.decision,
        rating: rng.int(2, 5),
        feedbackText: rng.pick(FEEDBACK),
        actionableAdvice,
        hasActionableFeedback,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + rng.int(0, 2) * 3_600_000),
      };
    });
}

function buildWalletsAndGrants(rng, seed, recruiters, candidates, swipes, reviews) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.talentId, candidate]));
  const wallets = [];
  const ledgerTransactions = [];
  const grants = [];

  for (const recruiter of recruiters) {
    const walletId = deterministicUuid(seed, `wallet:${recruiter.userId}`);
    const recruiterReviews = reviews.filter(
      (review) => review.recruiterUserId === recruiter.userId,
    );
    const recruiterSwipes = swipes.filter(
      (swipe) => swipe.recruiterUserId === recruiter.userId,
    );

    const ledger = [
      {
        id: deterministicUuid(seed, `credit:welcome:${walletId}`),
        amount: 20,
        type: 'CREDIT_WELCOME_BONUS',
        referenceId: walletId,
        description: 'Welcome bonus',
        createdAt: new Date(recruiter.createdAt.getTime() + 5 * 60_000),
      },
      {
        id: deterministicUuid(seed, `credit:purchase:${walletId}`),
        amount: 100,
        type: 'CREDIT_PURCHASE',
        referenceId: deterministicUuid(seed, `purchase:${recruiter.userId}`),
        description: 'Synthetic TalentCredits purchase',
        createdAt: new Date(recruiter.createdAt.getTime() + 2 * DAY_MS),
      },
      ...recruiterReviews
        .filter((review) => review.hasActionableFeedback)
        .map((review) => ({
          id: deterministicUuid(seed, `credit:review:${review.id}`),
          amount: 5,
          type: 'CREDIT_REVIEW_FEEDBACK',
          referenceId: review.id,
          description: 'Actionable review feedback reward',
          createdAt: new Date(review.createdAt.getTime() + 2 * 60_000),
        })),
    ].sort((left, right) => left.createdAt - right.createdAt);

    const approved = recruiterSwipes
      .filter((swipe) => swipe.decision === 'APPROVE')
      .sort((left, right) => left.createdAt - right.createdAt);

    let balance = 0;
    for (const transaction of ledger) {
      balance += transaction.amount;
      transaction.balanceAfter = balance;
    }

    const grantCandidates = [];
    for (const swipe of approved) {
      if (grantCandidates.length >= 2) break;
      if (balance < 50) break;
      const candidate = candidateById.get(swipe.talentId);
      if (!candidate) continue;

      const createdAt = new Date(
        Math.max(
          ledger.at(-1)?.createdAt?.getTime() ?? recruiter.createdAt.getTime(),
          swipe.createdAt.getTime(),
        ) + 3_600_000,
      );
      const grantId = deterministicUuid(seed, `grant:${recruiter.userId}:${swipe.talentId}`);
      balance -= 50;

      const debit = {
        id: deterministicUuid(seed, `debit:${grantId}`),
        amount: -50,
        type: 'DEBIT_TIER3_UNLOCK',
        referenceId: grantId,
        description: 'Unlocked Level-3 candidate profile',
        createdAt,
        balanceAfter: balance,
      };
      ledger.push(debit);
      grantCandidates.push({
        id: grantId,
        recruiterProfileId: recruiter.profileId,
        recruiterUserId: recruiter.userId,
        talentId: swipe.talentId,
        createdAt,
      });
    }

    ledger.sort((left, right) => left.createdAt - right.createdAt);
    // Recompute after the debit inserts so balances stay monotonic.
    let running = 0;
    for (const transaction of ledger) {
      running += transaction.amount;
      transaction.balanceAfter = running;
    }
    balance = running;

    const grantById = new Map(grantCandidates.map((grant) => [grant.id, grant]));
    for (const transaction of ledger) {
      if (transaction.type !== 'DEBIT_TIER3_UNLOCK') continue;
      const grant = grantById.get(transaction.referenceId);
      if (!grant) continue;
      grants.push({
        id: grant.id,
        recruiterProfileId: grant.recruiterProfileId,
        recruiterUserId: grant.recruiterUserId,
        talentId: grant.talentId,
        tierUnlocked: 'LEVEL_3_LEAD',
        expiresAt: null,
        createdAt: grant.createdAt,
      });
    }

    wallets.push({
      id: walletId,
      recruiterUserId: recruiter.userId,
      balance,
      version: ledger.length,
      createdAt: recruiter.createdAt,
      updatedAt: ledger.at(-1)?.createdAt ?? recruiter.createdAt,
    });

    for (const transaction of ledger) {
      ledgerTransactions.push({
        ...transaction,
        walletId,
        recruiterUserId: recruiter.userId,
        recruiterProfileId: recruiter.profileId,
      });
    }
  }

  return { wallets, ledgerTransactions, grants };
}

function makeEvent(seed, key, eventType, aggregateId, data, timestamp) {
  return {
    eventId: deterministicUuid(seed, `event:${key}`),
    eventType,
    aggregateId,
    timestamp: iso(timestamp),
    correlationId: deterministicUuid(seed, `correlation:${key}`),
    version: '1.0',
    data,
  };
}

function buildEvents(seed, candidates, recruiters, organizations, jobs, swipes, reviews, ledgerTransactions, grants, evaluations, notifications) {
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  const events = [];

  for (const organization of organizations) {
    // Auth owns user identities; organizations are recruiter-service records.
    void organizationById;
  }

  for (const candidate of candidates) {
    events.push(
      makeEvent(
        seed,
        `auth:candidate:${candidate.userId}`,
        'auth.user_registered',
        candidate.userId,
        {
          userId: candidate.userId,
          email: candidate.email,
          role: 'CANDIDATE',
          fullName: candidate.name,
        },
        candidate.createdAt,
      ),
      makeEvent(
        seed,
        `talent:created:${candidate.talentId}`,
        'talent.profile.created',
        candidate.talentId,
        {
          talentId: candidate.talentId,
          userId: candidate.userId,
          name: candidate.name,
          skills: candidate.skills,
          experienceYears: candidate.experienceYears,
          level: candidate.level,
          field: candidate.field,
          email: candidate.email,
          education: candidate.education,
          previousExperience: candidate.previousExperience,
          bio: candidate.bio,
        },
        candidate.createdAt,
      ),
    );
  }

  for (const recruiter of recruiters) {
    const organization = organizationById.get(recruiter.organizationId);
    events.push(
      makeEvent(
        seed,
        `auth:recruiter:${recruiter.userId}`,
        'auth.user_registered',
        recruiter.userId,
        {
          userId: recruiter.userId,
          email: recruiter.email,
          role: 'RECRUITER',
          fullName: recruiter.fullName,
        },
        recruiter.createdAt,
      ),
      makeEvent(
        seed,
        `recruiter:registered:${recruiter.profileId}`,
        'recruiter.registered',
        recruiter.profileId,
        {
          recruiterId: recruiter.profileId,
          userId: recruiter.userId,
          organizationId: recruiter.organizationId,
          email: recruiter.email,
          organizationName: organization?.name ?? recruiter.organizationName,
        },
        recruiter.createdAt,
      ),
    );
  }

  for (const job of jobs) {
    events.push(
      makeEvent(
        seed,
        `recruiter:job:${job.id}`,
        'recruiter.job_posted',
        job.id,
        {
          jobId: job.id,
          recruiterId: job.recruiterProfileId,
          organizationId: job.organizationId,
          title: job.title,
          requiredSkills: job.requiredSkills,
          employmentType: job.employmentType,
        },
        job.createdAt,
      ),
    );
  }

  for (const swipe of swipes) {
    events.push(
      makeEvent(
        seed,
        `swipe:${swipe.id}`,
        'swipe.recorded',
        swipe.id,
        {
          swipeId: swipe.id,
          recruiterId: swipe.recruiterUserId,
          talentId: swipe.talentId,
          decision: swipe.decision,
          timestamp: iso(swipe.createdAt),
        },
        swipe.createdAt,
      ),
    );
  }

  for (const review of reviews) {
    events.push(
      makeEvent(
        seed,
        `review:${review.id}`,
        'review.submitted',
        review.id,
        {
          reviewId: review.id,
          swipeId: review.swipeId,
          recruiterId: review.recruiterUserId,
          talentId: review.talentId,
          decision: review.decision,
          feedbackText: review.feedbackText,
          hasActionableFeedback: review.hasActionableFeedback,
          timestamp: iso(review.createdAt),
        },
        review.createdAt,
      ),
    );
  }

  for (const transaction of ledgerTransactions) {
    if (transaction.amount <= 0) continue;
    events.push(
      makeEvent(
        seed,
        `coins:${transaction.id}`,
        'rewards.coins_awarded',
        transaction.id,
        {
          walletId: transaction.walletId,
          recruiterId: transaction.recruiterUserId,
          amount: transaction.amount,
          type: transaction.type,
          referenceId: transaction.referenceId,
          balanceAfter: transaction.balanceAfter,
          timestamp: iso(transaction.createdAt),
        },
        transaction.createdAt,
      ),
    );
  }

  for (const grant of grants) {
    events.push(
      makeEvent(
        seed,
        `tier3:${grant.id}`,
        'rewards.tier3_unlocked',
        grant.id,
        {
          grantId: grant.id,
          recruiterId: grant.recruiterUserId,
          talentId: grant.talentId,
          chargedCredits: 50,
          timestamp: iso(grant.createdAt),
        },
        grant.createdAt,
      ),
    );
  }

  for (const evaluation of evaluations) {
    events.push(
      makeEvent(
        seed,
        `ai:${evaluation.id}`,
        'ai.evaluation.completed',
        evaluation.talentId,
        {
          evaluationId: evaluation.id,
          recruiterId: evaluation.recruiterUserId,
          talentId: evaluation.talentId,
          jobId: evaluation.jobId,
          score: evaluation.score,
          summary: evaluation.summary,
          timestamp: iso(evaluation.createdAt),
        },
        evaluation.createdAt,
      ),
    );
  }

  for (const notification of notifications) {
    events.push(
      makeEvent(
        seed,
        `notification:${notification.id}`,
        'notification.sent',
        notification.userId,
        {
          notificationId: notification.id,
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          channel: 'IN_APP',
          timestamp: iso(notification.createdAt),
        },
        notification.createdAt,
      ),
    );
  }

  return events.sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp));
}

function buildEvaluations(rng, seed, recruiters, swipes, anchorMs) {
  const evaluations = [];
  for (const recruiter of recruiters) {
    const approved = swipes.filter(
      (swipe) => swipe.recruiterUserId === recruiter.userId && swipe.decision === 'APPROVE',
    );
    for (const swipe of approved.slice(0, 3)) {
      if (!rng.bool(0.7)) continue;
      const score = Number(rng.float(0.72, 0.97).toFixed(4));
      if (score < 0.8) continue;
      evaluations.push({
        id: deterministicUuid(seed, `evaluation:${recruiter.userId}:${swipe.talentId}`),
        recruiterUserId: recruiter.userId,
        recruiterProfileId: recruiter.profileId,
        talentId: swipe.talentId,
        jobId: undefined,
        score,
        summary: `High-affinity match with a ${Math.round(score * 100)}% TalentLens score.`,
        createdAt: clampDate(
          new Date(swipe.createdAt.getTime() + 10 * 60_000),
          anchorMs - 60_000,
        ),
      });
    }
  }
  return evaluations;
}

function buildNotifications(seed, candidates, recruiters, reviews, ledgerTransactions, grants, evaluations) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.talentId, candidate]));
  const recruiterById = new Map(recruiters.map((recruiter) => [recruiter.userId, recruiter]));
  const notifications = [];

  for (const review of reviews) {
    const candidate = candidateById.get(review.talentId);
    if (!candidate) continue;
    notifications.push({
      id: deterministicObjectId(seed, `notification:review:${review.id}`),
      eventId: deterministicUuid(seed, `event:review:${review.id}`),
      userId: candidate.userId,
      type: 'REVIEW_RECEIVED',
      title: 'A recruiter reviewed your profile',
      body: review.hasActionableFeedback && review.feedbackText
        ? `A recruiter reviewed your profile and left feedback: "${review.feedbackText}"`
        : 'A recruiter reviewed your profile and left feedback!',
      data: {
        reviewId: review.id,
        talentId: review.talentId,
        recruiterId: review.recruiterUserId,
        decision: review.decision,
      },
      read: false,
      deliveryStatus: 'SENT',
      emailStatus: 'SKIPPED',
      createdAt: new Date(review.createdAt.getTime() + 60_000),
    });
  }

  for (const transaction of ledgerTransactions) {
    if (transaction.amount <= 0) continue;
    const recruiter = recruiterById.get(transaction.recruiterUserId);
    if (!recruiter) continue;
    const body =
      transaction.type === 'CREDIT_WELCOME_BONUS'
        ? `Welcome bonus: ${transaction.amount} TalentCredits added to your wallet.`
        : transaction.type === 'CREDIT_PURCHASE'
          ? `${transaction.amount} TalentCredits added to your wallet.`
          : `You earned ${transaction.amount} TalentCredits for your candidate review!`;
    notifications.push({
      id: deterministicObjectId(seed, `notification:coins:${transaction.id}`),
      eventId: deterministicUuid(seed, `event:coins:${transaction.id}`),
      userId: recruiter.userId,
      type: 'COINS_AWARDED',
      title: 'You earned TalentCredits',
      body,
      data: {
        walletId: transaction.walletId,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        referenceId: transaction.referenceId,
      },
      read: transaction.type === 'CREDIT_WELCOME_BONUS',
      deliveryStatus: 'SENT',
      emailStatus: 'SKIPPED',
      createdAt: new Date(transaction.createdAt.getTime() + 60_000),
    });
  }

  for (const grant of grants) {
    const candidate = candidateById.get(grant.talentId);
    if (!candidate) continue;
    notifications.push({
      id: deterministicObjectId(seed, `notification:tier3:${grant.id}`),
      eventId: deterministicUuid(seed, `event:tier3:${grant.id}`),
      userId: candidate.userId,
      type: 'TIER3_UNLOCKED',
      title: 'An employer unlocked your full profile',
      body: 'An employer unlocked your full profile. Your complete profile is now visible to their team.',
      data: {
        grantId: grant.id,
        recruiterId: grant.recruiterUserId,
        chargedCredits: 50,
      },
      read: false,
      deliveryStatus: 'SENT',
      emailStatus: 'SKIPPED',
      createdAt: new Date(grant.createdAt.getTime() + 60_000),
    });
  }

  for (const evaluation of evaluations) {
    const recruiter = recruiterById.get(evaluation.recruiterUserId);
    if (!recruiter) continue;
    notifications.push({
      id: deterministicObjectId(seed, `notification:ai:${evaluation.id}`),
      eventId: deterministicUuid(seed, `event:ai:${evaluation.id}`),
      userId: recruiter.userId,
      type: 'MATCH_FOUND',
      title: 'New high-affinity candidate match',
      body: evaluation.summary,
      data: {
        evaluationId: evaluation.id,
        talentId: evaluation.talentId,
        score: evaluation.score,
      },
      read: false,
      deliveryStatus: 'SENT',
      emailStatus: 'SKIPPED',
      createdAt: new Date(evaluation.createdAt.getTime() + 60_000),
    });
  }

  return notifications.sort((left, right) => left.createdAt - right.createdAt);
}

function buildAnalytics(seed, candidates, recruiters, jobs, swipes, reviews, ledgerTransactions, grants, evaluations, events) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.talentId, candidate]));
  const firstApproval = new Map();

  for (const swipe of swipes) {
    if (swipe.decision !== 'APPROVE') continue;
    const existing = firstApproval.get(swipe.talentId);
    if (!existing || swipe.createdAt < existing.createdAt) {
      firstApproval.set(swipe.talentId, swipe);
    }
  }

  const candidateMetrics = candidates.map((candidate) => {
    const candidateSwipes = swipes.filter(
      (swipe) => swipe.talentId === candidate.talentId && swipe.decision !== 'DEFER',
    );
    const first = firstApproval.get(candidate.talentId);
    return {
      talentId: candidate.talentId,
      userId: candidate.userId,
      rightSwipes: candidateSwipes.filter((swipe) => swipe.decision === 'APPROVE').length,
      leftSwipes: candidateSwipes.filter((swipe) => swipe.decision === 'REJECT').length,
      totalReviews: reviews.filter((review) => review.talentId === candidate.talentId).length,
      profileCreatedAt: candidate.createdAt,
      firstApprovedAt: first?.createdAt ?? null,
    };
  });

  const recruiterMetrics = recruiters.map((recruiter) => {
    const recruiterSwipes = swipes.filter(
      (swipe) => swipe.recruiterUserId === recruiter.userId && swipe.decision !== 'DEFER',
    );
    const recruiterReviews = reviews.filter(
      (review) => review.recruiterUserId === recruiter.userId,
    );
    const creditsEarned = ledgerTransactions
      .filter(
        (transaction) =>
          transaction.recruiterUserId === recruiter.userId && transaction.amount > 0,
      )
      .reduce((total, transaction) => total + transaction.amount, 0);
    const matches = [...firstApproval.values()].filter(
      (swipe) => swipe.recruiterUserId === recruiter.userId,
    );

    return {
      recruiterId: recruiter.userId,
      organizationId: recruiter.organizationId,
      openJobs: jobs.filter(
        (job) => job.recruiterProfileId === recruiter.profileId && job.status === 'OPEN',
      ).length,
      reviewsSubmitted: recruiterReviews.length,
      actionableFeedbackCount: recruiterReviews.filter(
        (review) => review.hasActionableFeedback,
      ).length,
      creditsEarned,
      approvals: recruiterSwipes.filter((swipe) => swipe.decision === 'APPROVE').length,
      rejections: recruiterSwipes.filter((swipe) => swipe.decision === 'REJECT').length,
      matchCount: matches.length,
      matchDelayMsSum: matches.reduce((total, swipe) => {
        const candidate = candidateById.get(swipe.talentId);
        return total + Math.max(0, swipe.createdAt - (candidate?.createdAt ?? swipe.createdAt));
      }, 0),
    };
  });

  const recruiterIdentities = recruiters.map((recruiter) => ({
    profileId: recruiter.profileId,
    userId: recruiter.userId,
    organizationId: recruiter.organizationId,
  }));

  const skillMetrics = new Map();
  for (const candidate of candidates) {
    for (const skill of new Set(candidate.skills)) {
      const metric = skillMetrics.get(skill) ?? {
        skill,
        demandCount: 0,
        supplyCount: 0,
        experienceSum: 0,
        experienceCount: 0,
      };
      metric.supplyCount += 1;
      metric.experienceSum += candidate.experienceYears;
      metric.experienceCount += 1;
      skillMetrics.set(skill, metric);
    }
  }
  for (const job of jobs) {
    if (job.status !== 'OPEN') continue;
    for (const skill of new Set(job.requiredSkills)) {
      const metric = skillMetrics.get(skill) ?? {
        skill,
        demandCount: 0,
        supplyCount: 0,
        experienceSum: 0,
        experienceCount: 0,
      };
      metric.demandCount += 1;
      skillMetrics.set(skill, metric);
    }
  }

  const recruiterSkillDemands = new Map();
  for (const job of jobs) {
    if (job.status !== 'OPEN') continue;
    const recruiter = recruiters.find(
      (entry) => entry.profileId === job.recruiterProfileId,
    );
    if (!recruiter) continue;
    for (const skill of new Set(job.requiredSkills)) {
      const key = `${recruiter.userId}:${skill}`;
      const current = recruiterSkillDemands.get(key) ?? {
        recruiterId: recruiter.userId,
        skill,
        jobCount: 0,
      };
      current.jobCount += 1;
      recruiterSkillDemands.set(key, current);
    }
  }

  const candidateSkills = candidates.flatMap((candidate) =>
    [...new Set(candidate.skills)].map((skill) => ({
      talentId: candidate.talentId,
      skill,
      experienceYears: candidate.experienceYears,
    })),
  );

  const funnel = new Map();
  const bump = (date, field, by = 1) => {
    const key = utcDay(date).toISOString();
    const current = funnel.get(key) ?? {
      day: utcDay(date),
      profilesCreated: 0,
      swipesRecorded: 0,
      reviewsSubmitted: 0,
      tier3Unlocks: 0,
      approvals: 0,
    };
    current[field] += by;
    funnel.set(key, current);
  };

  for (const candidate of candidates) bump(candidate.createdAt, 'profilesCreated');
  for (const swipe of swipes) {
    bump(swipe.createdAt, 'swipesRecorded');
    if (swipe.decision === 'APPROVE') bump(swipe.createdAt, 'approvals');
  }
  for (const review of reviews) bump(review.createdAt, 'reviewsSubmitted');
  for (const grant of grants) bump(grant.createdAt, 'tier3Unlocks');

  return {
    candidateMetrics,
    recruiterMetrics,
    recruiterIdentities,
    skillMetrics: [...skillMetrics.values()],
    recruiterSkillDemands: [...recruiterSkillDemands.values()],
    candidateSkills,
    funnelAggregates: [...funnel.values()].sort((left, right) => left.day - right.day),
    processedEvents: events.map((event) => ({
      eventId: event.eventId,
      eventType: event.eventType,
      processedAt: new Date(event.timestamp),
    })),
    evaluations,
  };
}

/**
 * Builds the full synthetic dataset. Pure function: the same seed, count and
 * anchor always produce byte-identical data (timestamps included).
 */
export function buildDataset({ seed, count = 24, anchorMs = Date.now() }) {
  const rng = createRng(seed);
  const candidateCount = Math.max(6, Math.floor(count));
  const recruiterCount = Math.max(3, Math.round(candidateCount / 6));
  const organizationCount = Math.max(2, Math.ceil(recruiterCount / 2));

  const organizations = Array.from({ length: organizationCount }, (_, index) =>
    buildOrganization(rng, seed, index, anchorMs),
  );

  const candidates = Array.from({ length: candidateCount }, (_, index) =>
    buildCandidate(rng, seed, index, anchorMs),
  );

  const recruiters = Array.from({ length: recruiterCount }, (_, index) => {
    const organization = organizations[index % organizations.length];
    return buildRecruiter(
      rng,
      seed,
      index,
      organization.id,
      organization.name,
      anchorMs,
    );
  });

  const jobs = Array.from({ length: recruiterCount * 2 }, (_, index) =>
    buildJob(rng, seed, index, recruiters[index % recruiters.length], anchorMs),
  );

  const swipes = buildSwipes(rng, seed, candidates, recruiters, anchorMs);
  const reviews = buildReviews(rng, seed, swipes);
  const { wallets, ledgerTransactions, grants } = buildWalletsAndGrants(
    rng,
    seed,
    recruiters,
    candidates,
    swipes,
    reviews,
  );
  const evaluations = buildEvaluations(rng, seed, recruiters, swipes, anchorMs);
  const notifications = buildNotifications(
    seed,
    candidates,
    recruiters,
    reviews,
    ledgerTransactions,
    grants,
    evaluations,
  );
  const events = buildEvents(
    seed,
    candidates,
    recruiters,
    organizations,
    jobs,
    swipes,
    reviews,
    ledgerTransactions,
    grants,
    evaluations,
    notifications,
  );
  const analytics = buildAnalytics(
    seed,
    candidates,
    recruiters,
    jobs,
    swipes,
    reviews,
    ledgerTransactions,
    grants,
    evaluations,
    events,
  );

  const qdrantPoints = candidates.map((candidate) => {
    const vector = localEmbedding(buildEmbeddingText(candidate), 384);
    return {
      id: toPointId(candidate.talentId),
      vector,
      payload: {
        talentId: candidate.talentId,
        userId: candidate.userId,
        name: candidate.name,
        field: candidate.field,
        fieldLower: candidate.field.toLowerCase(),
        skills: candidate.skills,
        skillsLower: candidate.skills.map((skill) => skill.toLowerCase()),
        experienceYears: candidate.experienceYears,
        level: candidate.level,
        education: candidate.education,
        previousExperience: candidate.previousExperience,
        bio: candidate.bio,
        indexedAt: iso(candidate.updatedAt),
      },
    };
  });

  return {
    seed,
    anchorMs,
    organizations,
    candidates,
    recruiters,
    jobs,
    swipes,
    reviews,
    wallets,
    ledgerTransactions,
    grants,
    evaluations,
    notifications,
    events,
    analytics,
    qdrantPoints,
  };
}

export const DATASET_COLLECTIONS = {
  healthcare: HEALTHCARE,
  employmentTypes: EMPLOYMENT_TYPES,
};

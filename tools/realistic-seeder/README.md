# Realistic seeder

`@talent-ai/realistic-seeder` writes a deterministic, privacy-safe dataset across
every talent.ai store so Grafana dashboards, alerts, funnels and TalentLens have
realistic activity to display:

| Store | Seeded data |
| :--- | :--- |
| PostgreSQL `talent_auth` | Candidate/recruiter users and RBAC roles. |
| PostgreSQL `talent_recruiter` | Organizations, recruiter profiles and job postings. |
| PostgreSQL `talent_engagement` | Swipes (approve/reject/defer), reviews and actionable feedback. |
| PostgreSQL `talent_rewards` | Wallets, the immutable ledger, Tier-3 grants. |
| PostgreSQL `talent_analytics` | Candidate/recruiter/skill metrics, funnel aggregates, `processed_events`. |
| MongoDB `talent_profiles` | Talent profile documents. |
| MongoDB `talent_notif` | Notifications plus talent/recruiter contact projections. |
| Qdrant | Normalised profile embeddings with the AI service's payload shape. |
| RabbitMQ (optional) | The matching domain-event history on `talent.events.topic`. |

## Quick start

```bash
# infrastructure + services must be running and migrated
pnpm infra:up
pnpm stack:up
pnpm --filter @talent-ai/auth-service db:deploy
# …deploy each service's migrations (see the root Readme)

# write the dataset
pnpm db:seed:realistic

# remove previously seeded rows first (local/development/test only)
pnpm db:seed:realistic:reset

# validate without connecting to anything
pnpm db:seed:realistic --dry-run
```

All seeded accounts use the password **`TalentSeed!2026`** and synthetic
`@synthetic.talent.test` email addresses. Phone numbers use the reserved
`+1-555-01xx` / `+1-555-02xx` ranges. No real person or company data is used.

## Options

| Option | Default | Description |
| :--- | :--- | :--- |
| `--seed <value>` | `talent-ai-phase-11` | PRNG seed and identifier namespace. |
| `--count <n>` | `24` | Base candidate count (6–500). Recruiters scale at ~1 per 6 candidates. |
| `--anchor <iso-date>` | current hour | Timestamp all generated history is relative to. |
| `--reset` | off | Delete previously seeded rows before writing. |
| `--publish` | off | Publish the generated events to RabbitMQ after seeding. |
| `--dry-run` | off | Build and validate the dataset, then exit. |
| `--help` | — | Print usage. |

Environment equivalents: `SEED`, `SEED_COUNT`, `SEED_ANCHOR`,
`SEED_PUBLISH_EVENTS`.

```bash
pnpm db:seed:realistic --count 60 --anchor 2026-11-08T00:00:00Z
pnpm db:seed:realistic --publish
```

## Determinism and idempotency

- Every identifier is derived from `sha1(<seed>:<logical-key>)`; the Qdrant
  point id uses the same `toPointId` mapping as `ai-matching-service`.
- Timestamps are derived from the anchor, never from the wall clock during the
  run. Repeating the same seed, count and anchor produces byte-identical output.
- Writes are upserts keyed by primary/unique constraints, so reruns converge on
  the same state instead of duplicating rows.
- `--reset` removes only the generated rows (matched by deterministic ids and
  the synthetic domain), not unrelated local data.

## Safety

Production is blocked unless `SEED_ALLOW_PRODUCTION=true` is set for an
intentional, reviewed demo seed. `--reset` remains blocked in production and is
also rejected for any `NODE_ENV` outside `development`, `test` and `local`.
`--dry-run` is always safe and does not open a single connection.

## Datastore overrides

The seeder reads the same variables as the services, with local Compose
defaults:

```text
DATABASE_URL, RECRUITER_DATABASE_URL, ENGAGEMENT_DATABASE_URL,
REWARDS_DATABASE_URL, ANALYTICS_DATABASE_URL,
MONGODB_URI, MONGODB_DB, NOTIFICATION_MONGODB_URI, NOTIFICATION_MONGODB_DB,
QDRANT_URL, QDRANT_COLLECTION, EMBEDDING_DIMENSIONS, QDRANT_API_KEY,
RABBITMQ_URL, RABBITMQ_EXCHANGE
```

## Tests

```bash
pnpm --filter @talent-ai/realistic-seeder test
```

The suite covers dataset determinism, UUID/point-id stability, embedding
normalisation, referential/privacy validation, CLI parsing and production
guards. It does not require Docker or any running datastore.

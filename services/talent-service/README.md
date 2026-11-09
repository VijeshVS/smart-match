# talent-service

Candidate profile aggregate for talent.ai.

- **Owner:** Vijesh (`@vijesh`)
- **Port:** 5002 (`PORT`)
- **Datastore:** MongoDB (`talent_profiles`)
- **Phase:** 2
- **Gateway prefix:** `/api/v1/talent`

## Responsibilities

- Owns `TalentProfile`, `Education`, `WorkExperience` and the Verified Talent
  Tier (`LEVEL_1_ENTRY`, `LEVEL_2_MID`, `LEVEL_3_LEAD`).
- **Explicitly excludes** `rightSwipes`, `leftSwipes` and `reviews`. Those
  belong to `engagement-service` and are fetched over REST/events.
- Publishes `talent.profile.created` and `talent.profile.updated` through a
  MongoDB transactional outbox so the AI indexer never sees a phantom profile.
- Verifies the caller's identity from gateway `x-user-*` headers, or directly
  from the bearer JWT when the gateway is bypassed in local development.

## API

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/talent` | Candidate, Admin | Create the caller's profile. |
| `GET` | `/api/v1/talent/me` | Authenticated | Fetch the caller's profile. |
| `GET` | `/api/v1/talent/blind` | Recruiter, Admin | Blind Talent Swipe queue. Omits identity, contact details, tier and profile links; keeps qualifications and work samples. |
| `GET` | `/api/v1/talent/:id` | Owner, Recruiter, Admin | Fetch one profile. |
| `GET` | `/api/v1/talent` | Recruiter, Admin | Paginated directory with search, skill, tier, field and experience filters. |
| `PUT` | `/api/v1/talent/:id` | Owner, Admin | Partial update; emits `talent.profile.updated` only when values change. |
| `PATCH` | `/api/v1/talent/:id/level` | Admin | Override the derived Verified Talent Tier. |

Query parameters for `GET /api/v1/talent`:

- `page`, `limit` (max 100)
- `search` — case-insensitive match across name, field, bio and skills
- `field` — exact field match
- `skills` — comma-separated or repeated; every skill must be present
- `level` — `LEVEL_1_ENTRY` | `LEVEL_2_MID` | `LEVEL_3_LEAD`
- `minExperienceYears`, `maxExperienceYears`

`GET /api/v1/talent/blind` accepts the same pagination, `field`, `skills` and
experience parameters, but deliberately drops `level` and searches only field
and skills so a recruiter cannot probe for identity or Elite status.

When `level` is omitted on creation it is derived from `experienceYears`:
`>= 8` → Elite Principal, `>= 3` → Pro Engineer, otherwise Junior Fellow.

## Events

| Routing key | When | Payload |
| :--- | :--- | :--- |
| `talent.profile.created` | Profile transaction commits | `talentId`, `userId`, `name`, `skills`, `experienceYears`, `level`, `field` |
| `talent.profile.updated` | A field actually changes | Created payload plus `changedFields` |

Both events follow the shared CloudEvents envelope from `@talent-ai/shared-types`.

## Transactional outbox

The profile document and an `outbox_events` document are written in the same
MongoDB session. A background relay claims pending rows with atomic
`findOneAndUpdate` calls (safe across replicas), publishes them to
`talent.events.topic`, and applies exponential backoff with a max-attempt cap.
Rows stuck in `PROCESSING` for two minutes are reclaimed.

The infra stack runs MongoDB as a single-node replica set (`rs0`) because
multi-document transactions require it.

## Configuration

Copy `.env.example` to `.env`, or rely on the repository root `.env`.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5002` | Listen port. |
| `MONGODB_URI` | — | Profile database connection string. |
| `MONGODB_DB` | `talent_profiles` | Database name override. |
| `JWT_ACCESS_SECRET` | — | Must match `auth-service` / `api-gateway`. |
| `TRUST_GATEWAY_HEADERS` | `true` | Trust `x-user-*` headers injected at the edge. |
| `RABBITMQ_URL` | `amqp://talent:talent@localhost:5672` | Outbox relay broker. |
| `OUTBOX_POLL_INTERVAL_MS` | `2000` | Relay cadence. |
| `OUTBOX_MAX_ATTEMPTS` | `10` | Attempts before a row is marked `FAILED`. |

## Observability

- `GET /health/liveness`, `GET /health/readiness` (Mongo + RabbitMQ) and
  `GET /metrics` follow the platform contract.
- OpenTelemetry starts before Express and Mongoose are imported.
- Every log line carries `correlationId` plus `trace_id` / `span_id`.

## Scripts

```bash
pnpm --filter @talent-ai/talent-service dev
pnpm --filter @talent-ai/talent-service build
pnpm --filter @talent-ai/talent-service test
```

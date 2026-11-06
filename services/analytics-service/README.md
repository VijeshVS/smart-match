# analytics-service

Event-sourced hiring analytics and read models for talent.ai.

- **Owner:** Vijesh (`@vijesh`) — reassigned from Varenya
- **Port:** 5008 (`PORT`)
- **Datastore:** PostgreSQL (`talent_analytics`)
- **Phase:** 7.2
- **Gateway prefix:** `/api/v1/analytics`

## Responsibilities

- Consumes **every** domain event on `talent.events.topic` through one durable
  queue (`analytics-service.all-events`).
- Projects events into denormalised read models so dashboards never replay the
  event log:
  - candidate acceptance vs rejection ratios and review counts,
  - top in-demand skills with candidate supply and average experience,
  - average time to first match, per recruiter and per candidate,
  - recruiter engagement leaderboards,
  - daily funnel totals.
- Resolves the two recruiter identifiers used across bounded contexts
  (`recruiter-service` profile ids vs engagement/rewards user ids) onto one
  canonical user id.
- Exposes the read models over an authenticated API.

## API

All routes require a verified identity. The API Gateway injects `x-user-*`
headers after JWT verification; direct calls may present a bearer token.

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/analytics/candidate/:id` | Candidate (own), Recruiter, Admin | Swipe ratios and review counts for a candidate. |
| `GET` | `/api/v1/analytics/recruiter/dashboard` | Recruiter, Admin | Own dashboard; admins may pass `?recruiterId=`. |
| `GET` | `/api/v1/analytics/skills?limit=10` | Any authenticated user | Top skills by job demand with supply and average experience. |
| `GET` | `/api/v1/analytics/leaderboard?limit=10` | Recruiter, Admin | Recruiters ranked by actionable feedback, then credits. |
| `GET` | `/api/v1/analytics/funnel?days=30` | Recruiter, Admin | Aggregated funnel counters for the trailing window. |

Candidates can only read their own candidate analytics. Requesting another
candidate's id returns `403 FORBIDDEN`. A recruiter who has not generated any
events yet receives a zero-filled dashboard instead of a 404.

```json
{
  "data": {
    "recruiterId": "…",
    "organizationId": "…",
    "openJobs": 2,
    "candidatesReviewed": 4,
    "approvals": 5,
    "rejections": 1,
    "creditsEarned": 15,
    "averageTimeToMatchHours": 1,
    "topSkills": [
      { "skill": "typescript", "demandCount": 4, "supplyCount": 10, "averageExperienceYears": 3 }
    ],
    "updatedAt": "2026-11-06T10:00:00.000Z"
  }
}
```

## Events

One durable queue (`EVENT_QUEUES.analyticsAllEvents`) binds every routing key in
`EVENT_ROUTING_KEYS`:

| Routing key | Projection |
| :--- | :--- |
| `talent.profile.created` / `talent.profile.updated` | Candidate metric, skill supply diff, funnel profile count. |
| `recruiter.registered` | Recruiter identity mapping and metric row. |
| `recruiter.job_posted` | Recruiter open-job count, skill demand and per-recruiter top skills. |
| `swipe.recorded` | Candidate right/left swipes, first-approval time, funnel counters. |
| `review.submitted` | Candidate review count, recruiter reviews and actionable feedback. |
| `rewards.coins_awarded` | Recruiter credits earned. |
| `rewards.tier3_unlocked` | Funnel tier-3 unlocks. |
| `ai.evaluation.completed` | Payload validation only; approvals already drive match metrics. |
| `auth.user_registered`, `notification.sent` | Recorded for idempotency, no aggregate yet. |

Every event is applied inside a PostgreSQL transaction that first inserts its
`eventId` into `processed_events`. At-least-once delivery therefore cannot double
count: a duplicate insert raises a unique violation and the transaction is
skipped. Handler failures roll back and are nacked to the shared dead-letter
queue.

Skill supply is diffed through `candidate_skills`, so a profile update that adds
or removes a skill adjusts `skill_metrics` instead of incrementing twice.

## Data model

PostgreSQL database `talent_analytics` (Prisma migrations under
`prisma/migrations`):

- `candidate_metrics` — swipes, reviews, first approval, profile creation, user id.
- `recruiter_metrics` — reviews, actionable feedback, credits, approvals,
  rejections, open jobs and match delay sum.
- `recruiter_identities` — profile id ↔ user id mapping.
- `recruiter_skill_demands` — required skills per recruiter's published jobs.
- `skill_metrics` / `candidate_skills` — supply, demand and experience aggregates.
- `funnel_aggregates` — daily counters keyed by UTC day.
- `processed_events` — consumer idempotency guard.

```bash
pnpm --filter @talent-ai/analytics-service db:deploy
pnpm --filter @talent-ai/analytics-service db:studio
```

## Configuration

Copy `.env.example` to `.env`, or rely on the repository root `.env`.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5008` | Listen port. |
| `ANALYTICS_DATABASE_URL` | — | `talent_analytics` connection string. |
| `RABBITMQ_URL` | `amqp://talent:talent@localhost:5672` | Event consumer. |
| `JWT_ACCESS_SECRET` | — | Must match `auth-service` / `api-gateway`. |
| `TRUST_GATEWAY_HEADERS` | `true` | Trust `x-user-*` headers injected at the edge. |

## Observability

- `GET /health/liveness`, `GET /health/readiness` (PostgreSQL + RabbitMQ) and
  `GET /metrics` follow the platform contract.
- OpenTelemetry starts before Express and Prisma are imported.
- Every log line carries `correlationId` plus `trace_id` / `span_id`.

## Scripts

```bash
pnpm --filter @talent-ai/analytics-service dev
pnpm --filter @talent-ai/analytics-service build
pnpm --filter @talent-ai/analytics-service test
pnpm --filter @talent-ai/analytics-service db:migrate
```

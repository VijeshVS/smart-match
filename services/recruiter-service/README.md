# recruiter-service

Recruiter, organization and job-posting aggregate for talent.ai.

- **Owner:** Vijesh (`@vijesh`)
- **Port:** 5003 (`PORT`)
- **Datastore:** PostgreSQL (`talent_recruiter`)
- **Phase:** 3
- **Gateway prefix:** `/api/v1/recruiters`

## Responsibilities

- Owns `Organization`, `RecruiterProfile` and `JobPosting` plus the recruiter
  role's team permissions snapshot.
- Associates each recruiter identity with one organization. Teammates that
  submit the same website/domain join the existing organization.
- Publishes `recruiter.registered` (on first profile creation) and
  `recruiter.job_posted` (when an `OPEN` posting is created) through a
  PostgreSQL transactional outbox.
- Verifies the caller's identity from gateway `x-user-*` headers, or directly
  from the bearer JWT when the gateway is bypassed in local development.

## API

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/recruiters/profile` | Recruiter, Admin | Create or update the caller's profile and organization. `201` on first creation, `200` on update. |
| `GET` | `/api/v1/recruiters/me` | Recruiter, Admin | Fetch the caller's profile with organization context. |
| `POST` | `/api/v1/recruiters/jobs` | Recruiter, Admin | Create a job posting in the caller's organization. |
| `GET` | `/api/v1/recruiters/jobs` | Authenticated | Paginated job listings. Candidates only see `OPEN` postings. |

The profile response shape is:

```json
{
  "data": {
    "profile": { "id": "…", "userId": "…", "permissions": ["recruiter:read"] },
    "organization": { "id": "…", "name": "Acme" }
  }
}
```

Query parameters for `GET /api/v1/recruiters/jobs`:

- `page`, `limit` (max 100)
- `search` — case-insensitive match across title, description and location
- `skills` — comma-separated or repeated; matches any required skill
- `employmentType` — `FULL_TIME` | `PART_TIME` | `CONTRACT` | `INTERNSHIP`
- `location` — case-insensitive location match
- `organizationId` — UUID filter
- `status` — `DRAFT` | `OPEN` | `CLOSED` | `ARCHIVED` | `ALL` (non-`OPEN`
  statuses require a recruiter or admin identity)

## Events

| Routing key | When | Payload |
| :--- | :--- | :--- |
| `recruiter.registered` | A new recruiter profile transaction commits | `recruiterId`, `userId`, `organizationId`, `email`, `organizationName` |
| `recruiter.job_posted` | An `OPEN` job posting transaction commits | `jobId`, `recruiterId`, `organizationId`, `title`, `requiredSkills`, `employmentType` |

Both events follow the shared CloudEvents envelope from `@talent-ai/shared-types`.
Draft postings do not emit `recruiter.job_posted`.

## Transactional outbox

The business row and `outbox_events` row are written in the same PostgreSQL
transaction. A background relay claims pending rows with
`SELECT … FOR UPDATE SKIP LOCKED` (safe across replicas), publishes them to
`talent.events.topic`, and applies exponential backoff with a max-attempt cap.
Rows stuck in `PROCESSING` for two minutes are reclaimed.

## Database

The service owns the `talent_recruiter` database created by the infrastructure
PostgreSQL init script. Prisma uses the `prisma-client` generator with ESM
output under `src/generated/prisma`, so it never clobbers the auth-service
client at the workspace root.

```bash
pnpm --filter @talent-ai/recruiter-service db:deploy
pnpm --filter @talent-ai/recruiter-service db:studio
```

## Configuration

Copy `.env.example` to `.env`, or rely on the repository root `.env`.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5003` | Listen port. |
| `RECRUITER_DATABASE_URL` | — | `talent_recruiter` connection string. |
| `JWT_ACCESS_SECRET` | — | Must match `auth-service` / `api-gateway`. |
| `TRUST_GATEWAY_HEADERS` | `true` | Trust `x-user-*` headers injected at the edge. |
| `RABBITMQ_URL` | `amqp://talent:talent@localhost:5672` | Outbox relay broker. |
| `OUTBOX_POLL_INTERVAL_MS` | `2000` | Relay cadence. |
| `OUTBOX_MAX_ATTEMPTS` | `10` | Attempts before a row is marked `FAILED`. |

## Observability

- `GET /health/liveness`, `GET /health/readiness` (PostgreSQL + RabbitMQ) and
  `GET /metrics` follow the platform contract.
- OpenTelemetry starts before Express and Prisma are imported.
- Every log line carries `correlationId` plus `trace_id` / `span_id`.

## Scripts

```bash
pnpm --filter @talent-ai/recruiter-service dev
pnpm --filter @talent-ai/recruiter-service build
pnpm --filter @talent-ai/recruiter-service test
pnpm --filter @talent-ai/recruiter-service db:migrate
```

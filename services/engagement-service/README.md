# engagement-service

Recruiter swipe, review and candidate-feedback aggregate for talent.ai.

- **Owner:** Vijesh (`@vijesh`)
- **Port:** 5004 (`PORT`)
- **Datastore:** PostgreSQL (`talent_engagement`)
- **Phase:** 4
- **Gateway prefix:** `/api/v1/engagement`

## Responsibilities

- Owns `Swipe` decisions (`APPROVE` / `REJECT`) and `Review` feedback. Candidate
  profiles and recruiter organizations stay in their own services.
- Enforces one swipe per `(recruiterId, talentId)` pair. Repeating the same
  decision is idempotent; changing it updates the row and republishes the event.
- Links an optional review to the swipe it belongs to. A swipe can have at most
  one review.
- Publishes `swipe.recorded` and `review.submitted` through a PostgreSQL
  transactional outbox.
- Verifies the caller's identity from gateway `x-user-*` headers, or directly
  from the bearer JWT when the gateway is bypassed in local development.

## API

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/engagement/swipes` | Recruiter, Admin | Record or change a swipe. `201` on first record, `200` on an idempotent repeat. |
| `POST` | `/api/v1/engagement/reviews` | Recruiter, Admin | Submit a review with a rating and/or feedback. `201` on creation. |
| `GET` | `/api/v1/engagement/talent/:talentId/summary` | Authenticated | Swipe counts plus recent reviews for the candidate dashboard. |
| `GET` | `/api/v1/engagement/recruiter/:recruiterId/history` | Owner, Admin | The recruiter's swipe and review history. |

`recruiterId` is optional in request bodies and defaults to the authenticated
user. Recruiters may only act as themselves; administrators may supply another
recruiter id. Sending a different id as a recruiter returns `403`.

### Swipe body

```json
{
  "talentId": "…",
  "decision": "APPROVE"
}
```

### Review body

```json
{
  "talentId": "…",
  "swipeId": "…",
  "decision": "APPROVE",
  "rating": 5,
  "feedbackText": "Strong systems thinking.",
  "actionableAdvice": "Add measurable outcomes to each project."
}
```

At least one of `rating`, `feedbackText` or `actionableAdvice` is required.
Blank optional text is dropped, and `hasActionableFeedback` is derived from
non-blank `actionableAdvice`. When `swipeId` is supplied, the swipe must belong
to the same recruiter and candidate and the decision must match.

## Events

| Routing key | When | Payload |
| :--- | :--- | :--- |
| `swipe.recorded` | A swipe is created or its decision changes | `swipeId`, `recruiterId`, `talentId`, `decision`, `timestamp` |
| `review.submitted` | A review transaction commits | `reviewId`, optional `swipeId`, `recruiterId`, `talentId`, `decision`, optional `feedbackText`, `hasActionableFeedback`, `timestamp` |

Both events follow the shared CloudEvents envelope from `@talent-ai/shared-types`.
An idempotent repeat of the same swipe decision emits no event.

## Transactional outbox

The business row and `outbox_events` row commit in the same PostgreSQL
transaction. A background relay claims pending rows with
`SELECT … FOR UPDATE SKIP LOCKED` (safe across replicas), publishes them to
`talent.events.topic`, and applies exponential backoff with a max-attempt cap.
Rows stuck in `PROCESSING` for two minutes are reclaimed.

## Database

The service owns the `talent_engagement` database created by the infrastructure
PostgreSQL init script. Prisma uses the `prisma-client` generator with ESM
output under `src/generated/prisma`, so it never clobbers another service's
generated client.

```bash
pnpm --filter @talent-ai/engagement-service db:deploy
pnpm --filter @talent-ai/engagement-service db:studio
```

## Configuration

Copy `.env.example` to `.env`, or rely on the repository root `.env`.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5004` | Listen port. |
| `ENGAGEMENT_DATABASE_URL` | — | `talent_engagement` connection string. |
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
pnpm --filter @talent-ai/engagement-service dev
pnpm --filter @talent-ai/engagement-service build
pnpm --filter @talent-ai/engagement-service test
pnpm --filter @talent-ai/engagement-service db:migrate
```

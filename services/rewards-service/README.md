# rewards-service

TalentCredits wallet, immutable coin ledger and Tier-3 access service for talent.ai.

- **Owner:** Vijesh (`@vijesh`)
- **Port:** 5005 (`PORT`)
- **Datastore:** PostgreSQL (`talent_rewards`)
- **Phase:** 5
- **Gateway prefix:** `/api/v1/rewards`

## Responsibilities

- Owns recruiter wallets, the append-only TalentCredits ledger and Level-3 access
  grants. Candidate profiles and recruiter organizations stay in their own
  services.
- Creates a wallet on first use and credits the shared welcome bonus
  (`TALENT_CREDIT_RULES.WELCOME_BONUS`, 20 TC) with a
  `CREDIT_WELCOME_BONUS` ledger entry.
- Consumes `review.submitted` and credits `REVIEW_FEEDBACK_REWARD` (5 TC) only
  when `hasActionableFeedback` is true.
- Charges `TIER3_UNLOCK_COST` (50 TC) to unlock a candidate's Level-3 profile,
  returning an active grant without a second charge.
- Publishes `rewards.coins_awarded` and `rewards.tier3_unlocked` through a
  PostgreSQL transactional outbox.
- Verifies the caller's identity from gateway `x-user-*` headers, or directly
  from the bearer JWT when the gateway is bypassed in local development.

## API

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/rewards/wallet` | Recruiter, Admin | Current balance plus the latest 100 ledger entries. |
| `POST` | `/api/v1/rewards/unlock-tier3` | Recruiter, Admin | Spend TalentCredits to unlock a candidate's Level-3 profile. |

`recruiterId` is optional and defaults to the authenticated user. Recruiters may
only act as themselves; administrators may supply another recruiter id. Sending
a different id as a recruiter returns `403`.

### Unlock body

```json
{
  "talentId": "…"
}
```

```json
{
  "data": {
    "grant": {
      "id": "…",
      "recruiterId": "…",
      "talentId": "…",
      "tierUnlocked": "LEVEL_3_LEAD",
      "createdAt": "2026-11-05T17:00:00.000Z"
    },
    "wallet": {
      "id": "…",
      "recruiterId": "…",
      "balance": 15,
      "version": 3,
      "createdAt": "…",
      "updatedAt": "…"
    },
    "chargedCredits": 50
  }
}
```

When an active grant already exists the response returns it with
`chargedCredits: 0` and the balance is untouched. When the wallet cannot cover
the cost the service returns `402 INSUFFICIENT_CREDITS` with
`details.requiredCredits` and `details.balance`.

## Ledger and concurrency

- `wallets.balance` is never updated without a matching `ledger_transactions`
  row in the same transaction. Credits are positive; debits are negative.
- `ledger_transactions.balance_after` snapshots the wallet balance for audit.
- Debits use optimistic locking: the update is predicated on the previously read
  `wallets.version`, and the whole transaction is retried if it changed.
- The unique `(type, reference_id)` index is the idempotency key. Review credits
  use `referenceId = reviewId`, so at-least-once delivery never double-credits.
- Unlock performs the balance check, debit, grant insert and outbox insert in a
  single PostgreSQL transaction. Any failure rolls everything back — that
  rollback is the compensation path. The unique
  `(recruiterId, talentId, tierUnlocked)` constraint makes concurrent unlocks
  converge on one grant without double charging.

## Events

| Direction | Routing key | Payload |
| :--- | :--- | :--- |
| Consume | `review.submitted` | Credits 5 TC when `hasActionableFeedback` is true. |
| Publish | `rewards.coins_awarded` | `walletId`, `recruiterId`, `amount`, `type`, optional `referenceId`, `balanceAfter`, `timestamp`. |
| Publish | `rewards.tier3_unlocked` | `grantId`, `recruiterId`, `talentId`, `chargedCredits`, optional `expiresAt`, `timestamp`. |

The review consumer is durable on
`EVENT_QUEUES.rewardsReviewConsumer` (`rewards-service.review-consumer`).
Malformed payloads and handler failures are nacked to the shared dead-letter
queue rather than acknowledged silently.

## Database

The service owns the `talent_rewards` database created by the infrastructure
PostgreSQL init script. Prisma uses the `prisma-client` generator with ESM
output under `src/generated/prisma`, so it never clobbers another service's
generated client.

```bash
pnpm --filter @talent-ai/rewards-service db:deploy
pnpm --filter @talent-ai/rewards-service db:studio
```

## Configuration

Copy `.env.example` to `.env`, or rely on the repository root `.env`.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5005` | Listen port. |
| `REWARDS_DATABASE_URL` | — | `talent_rewards` connection string. |
| `JWT_ACCESS_SECRET` | — | Must match `auth-service` / `api-gateway`. |
| `TRUST_GATEWAY_HEADERS` | `true` | Trust `x-user-*` headers injected at the edge. |
| `RABBITMQ_URL` | `amqp://talent:talent@localhost:5672` | Outbox relay and review consumer. |
| `OUTBOX_POLL_INTERVAL_MS` | `2000` | Relay cadence. |
| `OUTBOX_MAX_ATTEMPTS` | `10` | Attempts before a row is marked `FAILED`. |

## Observability

- `GET /health/liveness`, `GET /health/readiness` (PostgreSQL + RabbitMQ) and
  `GET /metrics` follow the platform contract.
- OpenTelemetry starts before Express and Prisma are imported.
- Every log line carries `correlationId` plus `trace_id` / `span_id`.

## Scripts

```bash
pnpm --filter @talent-ai/rewards-service dev
pnpm --filter @talent-ai/rewards-service build
pnpm --filter @talent-ai/rewards-service test
pnpm --filter @talent-ai/rewards-service db:migrate
```

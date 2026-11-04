# auth-service

Identity & access management for talent.ai.

- **Owner:** Vijesh (`@vijesh`)
- **Port:** 5001 (`PORT`)
- **Datastore:** PostgreSQL (`talent_auth`), Redis (sessions)
- **Phase:** 1.2

## Responsibilities

- `User`, `Role`, `RefreshToken`, `AuditLog` and transactional `OutboxEvent`
  tables (Prisma / PostgreSQL).
- Argon2id password hashing (OWASP baseline: 19 MiB, `t=2`, `p=1`).
- 15-minute HS256 access tokens and 7-day sliding refresh tokens, delivered as
  an `HttpOnly` cookie scoped to `/api/v1/auth`.
- Refresh-token rotation with reuse detection: replaying a rotated token revokes
  the whole session.
- RBAC permission claims derived from the canonical role → permission table.
- `auth.user_registered` published to RabbitMQ via a transactional outbox, so the
  event commits atomically with the user row.
- Structured audit logging for registration, login, failed login, refresh and
  logout.

## API

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | public | Create a `CANDIDATE` or `RECRUITER`; sets the refresh cookie; emits `auth.user_registered`. |
| `POST` | `/api/v1/auth/login` | public | Verify credentials; returns an access token and sets the refresh cookie. |
| `POST` | `/api/v1/auth/refresh` | refresh cookie/body | Rotates the refresh token and returns a new access token. |
| `POST` | `/api/v1/auth/logout` | refresh cookie / bearer | Revokes the session; pass `{ "allSessions": true }` to revoke every session for the user. |
| `GET` | `/api/v1/auth/me` | bearer | Returns the current user and permissions. |
| `GET` | `/health/liveness` | public | Process liveness. |
| `GET` | `/health/readiness` | public | PostgreSQL, Redis and RabbitMQ checks. |

Successful responses use `{ user, permissions, tokens }`. Errors use the shared
envelope `{ status, error: { code, message, correlationId, details? } }`.

## Configuration

Copy `.env.example` to `.env`, or rely on the repository root `.env`. Notable
variables:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | — | `talent_auth` PostgreSQL URL. |
| `REDIS_URL` | `redis://localhost:6379` | Session store. |
| `RABBITMQ_URL` | `amqp://talent:talent@localhost:5672` | Outbox relay. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | — | Must be ≥ 32 chars and match the gateway. |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | 15 minutes. |
| `REFRESH_TOKEN_TTL_SECONDS` | `604800` | 7 days. |
| `ARGON2_*` | OWASP baseline | Password hashing cost. |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Allowed portal origins. |
| `OUTBOX_*` | `2000ms` / `25` / `10` | Poll interval, batch size, max attempts. |

`NODE_ENV=production` rejects placeholder JWT secrets and requires
`COOKIE_SECURE=true` when `COOKIE_SAME_SITE=none`.

## Scripts

```bash
pnpm --filter @talent-ai/auth-service dev
pnpm --filter @talent-ai/auth-service build
pnpm --filter @talent-ai/auth-service test
pnpm --filter @talent-ai/auth-service db:generate
pnpm --filter @talent-ai/auth-service db:migrate
pnpm --filter @talent-ai/auth-service db:deploy
pnpm --filter @talent-ai/auth-service db:seed
```

Prisma commands load the service `.env` first, then the repository root `.env`
through `prisma.config.ts`.

## Outbox relay

Registration writes the user, audit entry and `OutboxEvent` in one transaction.
A background relay claims `PENDING`/`FAILED` rows with `FOR UPDATE SKIP LOCKED`,
publishes them to `talent.events.topic`, and retries with exponential backoff up
to `OUTBOX_MAX_ATTEMPTS`. Rows left in `PROCESSING` after a crash are recovered
after two minutes.

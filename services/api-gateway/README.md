# api-gateway

Single edge entry point for every talent.ai domain service.

- **Owner:** Vijesh (`@vijesh`)
- **Port:** 8080 (`API_GATEWAY_PORT`)
- **Datastore:** Redis (distributed rate limiting)
- **Phase:** 1.3

## Responsibilities

- **Correlation IDs** — reuses `X-Correlation-ID` when supplied, otherwise
  generates a UUIDv4, echoes it on the response, and forwards it downstream as
  both `x-correlation-id` and `x-request-id`.
- **JWT verification** — verifies HS256 access tokens issued by `auth-service`
  and injects trusted `x-user-id`, `x-user-role`, `x-user-email` and
  `x-session-id` headers. Client-supplied identity headers are always stripped.
- **Rate limiting** — atomic Redis token bucket. Auth and AI routes use the
  sensitive bucket (5 req/min by IP/user); every other domain route uses the
  general bucket (60 req/min by user).
- **Routing** — proxies `/api/v1/...` prefixes to their owning service without
  stripping the prefix.
- **Circuit breaking** — one breaker per downstream. After
  `CIRCUIT_FAILURE_THRESHOLD` consecutive failures the route fails fast with
  `503 CIRCUIT_OPEN` until the cooldown elapses, then admits a single probe.
- **Unified CORS and errors** — one CORS policy at the edge; downstream CORS
  headers are discarded. Errors always use
  `{ status, error: { code, message, correlationId, details? } }`.

## Routes

| Prefix | Downstream | Auth | Bucket |
| :--- | :--- | :--- | :--- |
| `/api/v1/auth` | auth-service | optional | sensitive |
| `/api/v1/ai` | ai-matching-service | required | sensitive |
| `/api/v1/talent` | talent-service | required | general |
| `/api/v1/recruiters` | recruiter-service | required | general |
| `/api/v1/engagement` | engagement-service | required | general |
| `/api/v1/rewards` | rewards-service | required | general |
| `/api/v1/notifications` | notification-service | required | general |
| `/api/v1/analytics` | analytics-service | required | general |

`/health/liveness` and `/health/readiness` are served locally. Readiness
includes a snapshot of every circuit breaker.

## Configuration

Copy `.env.example` to `.env`, or rely on the repository root `.env`. Notable
variables:

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `API_GATEWAY_PORT` | `8080` | Listen port (deliberately distinct from auth's `PORT`). |
| `REDIS_URL` | `redis://localhost:6379` | Rate-limit buckets. |
| `JWT_ACCESS_SECRET` | — | Must match `auth-service`. |
| `*_SERVICE_URL` | `http://localhost:500x` | Downstream targets. |
| `RATE_LIMIT_GENERAL_PER_MINUTE` | `60` | General bucket capacity. |
| `RATE_LIMIT_SENSITIVE_PER_MINUTE` | `5` | Auth/AI bucket capacity. |
| `RATE_LIMIT_FAIL_OPEN` | `true` | Allow traffic when Redis is unreachable. |
| `PROXY_TIMEOUT_MS` | `10000` | Downstream timeout; produces `504 UPSTREAM_TIMEOUT`. |
| `CIRCUIT_FAILURE_THRESHOLD` | `5` | Consecutive failures before opening. |
| `CIRCUIT_RESET_TIMEOUT_MS` | `30000` | Cooldown before a half-open probe. |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Allowed portal origins. |

## Rate-limit headers

Successful requests return `RateLimit-Limit`, `RateLimit-Remaining`,
`RateLimit-Reset` and `RateLimit-Policy`. A rejected request returns `429` with
`Retry-After` and `error.code = RATE_LIMIT_EXCEEDED`.

## Scripts

```bash
pnpm --filter @talent-ai/api-gateway dev
pnpm --filter @talent-ai/api-gateway build
pnpm --filter @talent-ai/api-gateway test
```

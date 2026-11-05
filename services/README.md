# talent.ai Microservices

This directory hosts the domain services that replace the legacy `candidate/backend` and
`hr/backend` monoliths. Each service owns its database (database-per-service) and
communicates with the rest of the platform through REST/gRPC or the `talent.events.topic`
RabbitMQ exchange.

| Service | Port | Datastore | Owner | Phase |
| :--- | :--- | :--- | :--- | :--- |
| `api-gateway` | 8080 | Redis | Vijesh | 1 |
| `auth-service` | 5001 | PostgreSQL (`talent_auth`) | Vijesh | 1 |
| `talent-service` | 5002 | MongoDB (`talent_profiles`) | Vijesh | 2 (implemented) |
| `recruiter-service` | 5003 | PostgreSQL (`talent_recruiter`) | Varenya | 3 |
| `engagement-service` | 5004 | PostgreSQL (`talent_engagement`) | Arun | 4 |
| `rewards-service` | 5005 | PostgreSQL (`talent_rewards`) | Arun | 5 |
| `ai-matching-service` | 5006 | Qdrant + Redis | Varenya | 6 |
| `notification-service` | 5007 | MongoDB (`talent_notif`) | Arun | 7 |
| `analytics-service` | 5008 | PostgreSQL / ClickHouse | Varenya | 7 |

> Phase 0 establishes the workspace layout only. Service implementations are delivered in
> their respective phases. `auth-service`, `api-gateway` and `talent-service` are implemented;
> shared contracts live in `packages/shared-types`, logging in
> `packages/logger`, messaging in `packages/event-bus`, and tracing/metrics/secrets in
> `packages/observability`.

## Platform observability

Every service is expected to adopt the same observability contract:

- Preload `@talent-ai/observability/tracing` before Express/Prisma/Redis imports.
- Expose `GET /health/liveness`, `GET /health/readiness` and `GET /metrics`.
- Use `@talent-ai/logger`, which stamps `trace_id` / `span_id` automatically.
- Load credentials with `loadSecret()` so `<NAME>_FILE` mounted secrets work.

`auth-service` and `api-gateway` are the reference implementations; copy their
`src/tracing.ts`, `createHttpMetrics()` wiring and Docker/Kubernetes manifests
when adding a service.

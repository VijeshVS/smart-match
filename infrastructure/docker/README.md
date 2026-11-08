# Docker infrastructure

| File | Purpose |
| :--- | :--- |
| `docker-compose.infra.yml` | PostgreSQL 16, Redis 7, RabbitMQ 3.13, Qdrant, MailHog, a single-node MongoDB replica set, and the observability stack (Jaeger, Prometheus, Grafana). |
| `docker-compose.app.yml` | Application services (`auth-service`, `talent-service`, `recruiter-service`, `engagement-service`, `rewards-service`, `ai-matching-service`, `api-gateway`) built from `Dockerfile.service`. |
| `Dockerfile.service` | Generic multi-stage Node 22/Alpine image for any workspace service. |
| `../../docker-compose.yml` | Unified entry point that `include`s both stacks above. |
| `docker-compose.yml` | Phase 0 transitional MongoDB instance for the legacy monolith. |
| `postgres/init/01-create-databases.sql` | Creates `talent_recruiter`, `talent_engagement`, `talent_rewards` (and the `pgcrypto` extension in each database). `talent_auth` is created by the Postgres image via `POSTGRES_DB`. |
| `mongo/init-replica.js` | Initiates the `rs0` single-node replica set required for transactions and change streams. |
| `rabbitmq/rabbitmq.conf` | Loads the exchange/queue definitions on boot. |
| `rabbitmq/enabled_plugins` | Enables `rabbitmq_management` and `rabbitmq_prometheus` (scraped on `:15692`). |
| `rabbitmq/definitions.json` | Declares the `talent.events.topic` exchange, the `talent.events.dlx` dead-letter exchange, the `talent.events.dlq` queue, and the `talent` administrator user. |
| `prometheus/prometheus.yml` | Scrapes every service, RabbitMQ (`:15692`), Qdrant and the PostgreSQL/Redis/MongoDB exporters every 15s. |
| `prometheus/rules/talent-ai.yml` | Recording and alerting rules for availability, RED metrics, events, AI, rewards and analytics. |
| `grafana/provisioning/` | Prometheus + analytics PostgreSQL datasources and the read-only dashboard provider. |
| `grafana/dashboards/*.json` | Six generated dashboards: platform overview, service health, conversion funnels, AI/TalentLens, events/RabbitMQ, rewards/notifications/analytics. |

## Usage

Run from the repository root:

```bash
# infrastructure only
pnpm infra:up          # docker compose -f infrastructure/docker/docker-compose.infra.yml up -d
pnpm infra:logs
pnpm infra:down        # preserves named volumes
pnpm infra:nuke        # destroys containers + volumes

# just the observability trio
pnpm obs:up            # Jaeger + Prometheus + Grafana

# infrastructure + application services (unified stack)
pnpm stack:up          # docker compose up -d --build
pnpm stack:logs
pnpm stack:down
```

The unified `docker-compose.yml` requires a root `.env` with at least
`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (both ≥ 32 characters). Copy
`.env.example` and fill them in.

### Building a single service image

```bash
docker build \
  -f infrastructure/docker/Dockerfile.service \
  --build-arg SERVICE_NAME=api-gateway \
  --build-arg SERVICE_PATH=services/api-gateway \
  --build-arg APP_PORT=8080 \
  -t talent-ai/api-gateway:local .
```

The Dockerfile uses `turbo prune` to install only the dependencies a service
needs, builds workspace packages, then produces a production-only bundle with
`pnpm deploy`. Images run as the unprivileged `node` user with `tini` as PID 1.

## Endpoints

| Service | Address |
| :--- | :--- |
| PostgreSQL | `postgresql://talent:talent@localhost:5432` |
| MongoDB | `mongodb://localhost:27017/talent_profiles?directConnection=true` |
| Redis | `redis://localhost:6379` |
| RabbitMQ AMQP | `amqp://talent:talent@localhost:5672` |
| RabbitMQ Management | <http://localhost:15672> (`talent` / `talent`) |
| RabbitMQ Prometheus | <http://localhost:15692/metrics> |
| Qdrant | <http://localhost:6333> |
| MailHog SMTP | `localhost:1025` |
| MailHog UI | <http://localhost:8025> |
| Jaeger UI | <http://localhost:16686> |
| OTLP/HTTP collector | `http://localhost:4318` |
| OTLP/gRPC collector | `localhost:4317` |
| Prometheus | <http://localhost:9090> |
| Grafana | <http://localhost:3100> (`admin` / `admin`) |
| PostgreSQL exporter | <http://localhost:9187/metrics> |
| Redis exporter | <http://localhost:9121/metrics> |
| MongoDB exporter | <http://localhost:9216/metrics> |
| auth-service (app stack) | <http://localhost:5001> |
| talent-service (app stack) | <http://localhost:5002> |
| recruiter-service (app stack) | <http://localhost:5003> |
| engagement-service (app stack) | <http://localhost:5004> |
| rewards-service (app stack) | <http://localhost:5005> |
| ai-matching-service (app stack) | <http://localhost:5006> |
| api-gateway (app stack) | <http://localhost:8080> |

## Observability

- Every service boots `@talent-ai/observability` before Express/Prisma/Redis so
  HTTP, Express, ioredis, amqplib and Postgres spans are captured.
- Spans are exported over OTLP/HTTP to `OTEL_EXPORTER_OTLP_ENDPOINT`
  (`http://jaeger:4318` inside Compose, `http://localhost:4318` from the host).
- `GET /metrics` exposes `http_requests_total`,
  `http_request_duration_seconds`, `http_requests_in_flight`, domain/business
  metrics, and the default Node process metrics (prefixed `talent_`). Every
  metric carries `service` and `env` labels.
- Grafana dashboards are generated from
  `scripts/generate-grafana-dashboards.mjs`, committed under
  `grafana/dashboards/`, and auto-provisioned. Edit the generator, then run
  `pnpm dashboards:generate`.
- Alert rules live in `prometheus/rules/talent-ai.yml` and link to the runbooks
  in `docs/runbooks/`. Check them with:
  ```bash
  docker run --rm -v "$PWD/infrastructure/docker/prometheus:/etc/prometheus" \
    --entrypoint promtool prom/prometheus:v3.1.0 \
    check rules /etc/prometheus/rules/talent-ai.yml
  ```
- Seed deterministic demo activity across every store with
  `pnpm db:seed:realistic` (see `tools/realistic-seeder/README.md`). Use
  `--reset` only in local/development/test.
- `GET /health/liveness` and `GET /health/readiness` are the Kubernetes/Docker
  probe endpoints; `/health/readiness` verifies downstream dependencies.
- Pino log lines include `trace_id` / `span_id` from the active OpenTelemetry
  span, so Jaeger traces can be cross-referenced with logs.

Prometheus discovers containers by DNS name on `talent-ai-network`. When a
service runs on the host instead of Compose, change its target in
`prometheus/prometheus.yml` to `host.docker.internal:<port>`.

## Notes

- The MongoDB replica set runs as a single node named `rs0`. Host tools must
  connect with `?directConnection=true`; containers on
  `talent-ai-network` can use `mongodb://mongodb:27017`.
- `mongodb-init` is a one-shot helper that exits after the replica set becomes
  primary. `docker compose ps` shows it as `Exited (0)` once complete.
- Every container, volume and network uses the `talent-ai-*` / `talent_ai_*`
  prefix.
- Local development credentials (`talent` / `talent`, `admin` / `admin`) are
  intentionally non-secret. Replace them for any shared or deployed environment.

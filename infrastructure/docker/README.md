# Docker infrastructure

| File | Purpose |
| :--- | :--- |
| `docker-compose.infra.yml` | Phase 1.1: PostgreSQL 16, Redis 7, RabbitMQ 3.13, Qdrant, MailHog and a single-node MongoDB replica set. |
| `docker-compose.yml` | Phase 0 transitional MongoDB instance for the legacy monolith. |
| `postgres/init/01-create-databases.sql` | Creates `talent_recruiter`, `talent_engagement`, `talent_rewards` (and the `pgcrypto` extension in each database). `talent_auth` is created by the Postgres image via `POSTGRES_DB`. |
| `mongo/init-replica.js` | Initiates the `rs0` single-node replica set required for transactions and change streams. |
| `rabbitmq/rabbitmq.conf` | Loads the exchange/queue definitions on boot. |
| `rabbitmq/definitions.json` | Declares the `talent.events.topic` exchange, the `talent.events.dlx` dead-letter exchange, the `talent.events.dlq` queue, and the `talent` administrator user. |

## Usage

Run from the repository root:

```bash
# canonical Phase 1 stack
pnpm infra:up          # docker compose -f infrastructure/docker/docker-compose.infra.yml up -d
pnpm infra:logs
pnpm infra:down        # preserves named volumes
pnpm infra:nuke        # destroys containers + volumes

# legacy Phase 0 MongoDB only
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Both stacks publish MongoDB on `27017`, so run one at a time.

## Endpoints

| Service | Address |
| :--- | :--- |
| PostgreSQL | `postgresql://talent:talent@localhost:5432` |
| MongoDB | `mongodb://localhost:27017/talent_ai?directConnection=true` |
| Redis | `redis://localhost:6379` |
| RabbitMQ AMQP | `amqp://talent:talent@localhost:5672` |
| RabbitMQ Management | <http://localhost:15672> (`talent` / `talent`) |
| Qdrant | <http://localhost:6333> |
| MailHog SMTP | `localhost:1025` |
| MailHog UI | <http://localhost:8025> |

## Notes

- The MongoDB replica set runs as a single node named `rs0`. Host tools must
  connect with `?directConnection=true`; containers on
  `talent-ai-network` can use `mongodb://mongodb:27017`.
- `mongodb-init` is a one-shot helper that exits after the replica set becomes
  primary. `docker compose ps` shows it as `Exited (0)` once complete.
- Every container, volume and network uses the `talent-ai-*` / `talent_ai_*`
  prefix.
- Local development credentials (`talent` / `talent`) are intentionally
  non-secret. Replace them for any shared or deployed environment.

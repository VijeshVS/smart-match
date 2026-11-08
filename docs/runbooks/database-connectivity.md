# Datastore connectivity

Alert: `TalentServiceDependencyDown` (PostgreSQL, Redis, MongoDB, RabbitMQ or
Qdrant exporter reports down).

## Triage

1. Identify the failing dependency:
   ```promql
   pg_up
   redis_up
   mongodb_up
   up{job=~"rabbitmq|qdrant"}
   ```
2. Check the container/pod and its logs:
   ```bash
   docker compose -f infrastructure/docker/docker-compose.infra.yml ps
   docker compose -f infrastructure/docker/docker-compose.infra.yml logs --tail=200 postgres redis mongodb rabbitmq qdrant
   # Kubernetes
   kubectl -n talent-ai get pods
   kubectl -n talent-ai logs deploy/<dependency> --tail=200
   ```
3. Confirm readiness, not just liveness. Services expose `/health/readiness`
   which probes their datastores:
   ```bash
   curl -fsS http://localhost:5005/health/readiness | jq
   ```
4. Check resource pressure: disk full, memory limit, connection limit.

## Dependency-specific checks

| Dependency | Command |
| :--- | :--- |
| PostgreSQL | `pg_isready -h localhost -p 5432`; `SELECT count(*) FROM pg_stat_activity;` |
| Redis | `redis-cli -u redis://localhost:6379 ping`; `INFO memory` |
| MongoDB | `mongosh 'mongodb://localhost:27017/?directConnection=true' --eval 'db.runCommand({ ping: 1 })'` |
| RabbitMQ | `rabbitmq-diagnostics -q ping`; management UI on `:15672` |
| Qdrant | `curl -fsS http://localhost:6333/readyz` |

## Recovery

- Restart only the unhealthy dependency first; keep volumes intact.
- If PostgreSQL is down for writes, stop producers or accept outbox backlog;
  consumers should recover from the outbox once the database returns.
- Never `down -v` / delete PVCs to "fix" connectivity; that destroys service
  data. `pnpm infra:nuke` is a local-only last resort.

## Verification

- Exporter `*_up` returns `1`.
- `/health/readiness` returns 200 for every affected service.
- No new connection-pool or timeout errors in the logs.

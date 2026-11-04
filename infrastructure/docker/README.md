# Docker infrastructure

| File | Purpose |
| :--- | :--- |
| `docker-compose.yml` | Phase 0 transitional MongoDB instance for the legacy monolith. |
| `docker-compose.infra.yml` | Phase 1.1: PostgreSQL 16, Redis 7, RabbitMQ 3.13, Qdrant, MailHog and the MongoDB replica set. **Not created yet.** |

Usage from the repository root:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

All containers, volumes and networks use the `talent-ai-*` / `talent_ai_*` prefix.

# talent.ai Microservices

This directory hosts the domain services that replace the legacy `candidate/backend` and
`hr/backend` monoliths. Each service owns its database (database-per-service) and
communicates with the rest of the platform through REST/gRPC or the `talent.events.topic`
RabbitMQ exchange.

| Service | Port | Datastore | Owner | Phase |
| :--- | :--- | :--- | :--- | :--- |
| `api-gateway` | 8080 | Redis | Vijesh | 1 |
| `auth-service` | 5001 | PostgreSQL (`talent_auth`) | Vijesh | 1 |
| `talent-service` | 5002 | MongoDB (`talent_profiles`) | Arun | 2 |
| `recruiter-service` | 5003 | PostgreSQL (`talent_recruiter`) | Varenya | 3 |
| `engagement-service` | 5004 | PostgreSQL (`talent_engagement`) | Arun | 4 |
| `rewards-service` | 5005 | PostgreSQL (`talent_rewards`) | Arun | 5 |
| `ai-matching-service` | 5006 | Qdrant + Redis | Varenya | 6 |
| `notification-service` | 5007 | MongoDB (`talent_notif`) | Arun | 7 |
| `analytics-service` | 5008 | PostgreSQL / ClickHouse | Varenya | 7 |

> Phase 0 establishes the workspace layout only. Service implementations are delivered in
> their respective phases. Shared contracts live in `packages/shared-types`, logging in
> `packages/logger`, and messaging in `packages/event-bus`.

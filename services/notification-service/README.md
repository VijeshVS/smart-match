# notification-service

Event-driven in-app and email notifications for talent.ai.

- **Owner:** Vijesh (`@vijesh`) — reassigned from Arun
- **Port:** 5007 (`PORT`)
- **Datastore:** MongoDB (`talent_notif`)
- **Phase:** 7.1
- **Gateway prefix:** `/api/v1/notifications`
- **WebSocket:** `/ws/notifications?token=<access token>`

## Responsibilities

- Owns notification history and read state for every talent.ai account.
- Keeps lightweight contact projections for candidates (`talent.profile.*`) and
  recruiters (`recruiter.registered`) so domain events can be addressed to a user
  and email.
- Pushes live in-app notifications over `ws`, and fans them to every replica
  through Redis pub/sub.
- Sends branded, table-based transactional email through Nodemailer. Without
  `SMTP_URL`, Nodemailer's JSON transport renders the message into the log so
  local development stays offline.
- Publishes `notification.sent` after the in-app notification is persisted.

## API

All routes require a verified identity. The API Gateway injects `x-user-*`
headers after JWT verification; direct calls may present a bearer token. Every
route is scoped to the authenticated user.

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Paginated history. Supports `page`, `limit` and `unreadOnly`. |
| `GET` | `/api/v1/notifications/unread-count` | Unread badge count. |
| `PATCH` | `/api/v1/notifications/:id/read` | Body `{ "read": true \| false }`. |

```json
{
  "data": [
    {
      "id": "…",
      "userId": "…",
      "type": "COINS_AWARDED",
      "title": "You earned TalentCredits",
      "body": "You earned 5 TalentCredits for your candidate review!",
      "read": false,
      "deliveryStatus": "SENT",
      "createdAt": "2026-11-06T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false }
}
```

## WebSocket

Connect to `ws://<host>:5007/ws/notifications?token=<access token>` (or send an
`Authorization: Bearer` header). The token is verified with the same secret,
issuer and audience as the REST API; unauthenticated upgrades receive
`401 Unauthorized`.

```json
{ "type": "connected", "data": { "userId": "…", "timestamp": "…" } }
{ "type": "notification", "data": { "id": "…", "type": "REVIEW_RECEIVED", "…": "…" } }
```

Connections are keyed by user id, and a 30 second ping/pong heartbeat drops dead
peers. Notifications persisted by any replica are republished on the Redis
channel `NOTIFICATION_FANOUT_CHANNEL` (`talent.notifications`) and delivered to
sockets held by every replica. If Redis is unavailable, live delivery falls back
to sockets connected to the replica that processed the event; the history API
remains the source of truth.

## Events

| Direction | Routing key | Behaviour |
| :--- | :--- | :--- |
| Consume | `talent.profile.created`, `talent.profile.updated` | Refresh the candidate contact projection (user id, name, email). |
| Consume | `recruiter.registered` | Refresh the recruiter contact projection. |
| Consume | `review.submitted` | Candidate alert: a recruiter reviewed the profile. Includes actionable feedback when present. |
| Consume | `rewards.coins_awarded` | Recruiter alert: TalentCredits were earned. |
| Consume | `rewards.tier3_unlocked` | Candidate alert: an employer unlocked the full profile. |
| Consume | `ai.evaluation.completed` | Recruiter alert: a high-affinity candidate match was found. |
| Publish | `notification.sent` | In-app notification acknowledgement. |

Durable queues are declared in `EVENT_QUEUES`:
`notification-service.talent-consumer`, `notification-service.registration-consumer`,
`notification-service.review-consumer`, `notification-service.rewards-consumer`
and `notification-service.match-consumer`.

Delivery is at least once, so every notification document carries the originating
`eventId` behind a unique index. A redelivered event is a no-op instead of a
duplicate alert. Handler failures are nacked to the shared dead-letter queue.
A candidate alert that arrives before the contact projection is indexed is
logged and skipped rather than dead-lettered, because the projection event is
still in flight on another queue.

## Data model

MongoDB collection `talent_notif`:

- `notifications` — history, read state, delivery status, email status.
- `talent_contacts` — `talentId` → `userId`, name, email.
- `recruiter_contacts` — `userId` → profile id, organization id, email.

## Configuration

Copy `.env.example` to `.env`, or rely on the repository root `.env`.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5007` | Listen port. |
| `NOTIFICATION_MONGODB_URI` | — | `talent_notif` connection string. |
| `NOTIFICATION_MONGODB_DB` | `talent_notif` | Database name. |
| `REDIS_URL` | `redis://localhost:6379` | Realtime fan-out. |
| `NOTIFICATION_FANOUT_CHANNEL` | `talent.notifications` | Pub/sub channel. |
| `WEBSOCKET_PATH` | `/ws/notifications` | Upgrade path. |
| `EMAIL_ENABLED` | `false` | Send email instead of rendering it. |
| `EMAIL_FROM` | `talent.ai <no-reply@talent.ai>` | Sender identity. |
| `SMTP_URL` | — | Relay URL; required when email is enabled in production. |
| `JWT_ACCESS_SECRET` | — | Must match `auth-service` / `api-gateway`. |
| `TRUST_GATEWAY_HEADERS` | `true` | Trust `x-user-*` headers injected at the edge. |
| `RABBITMQ_URL` | `amqp://talent:talent@localhost:5672` | Event consumers and `notification.sent`. |

## Observability

- `GET /health/liveness`, `GET /health/readiness` (MongoDB + RabbitMQ + Redis)
  and `GET /metrics` follow the platform contract. Redis is optional, so an
  outage degrades readiness rather than failing it.
- OpenTelemetry starts before Express, Mongoose and the WebSocket server.
- Every log line carries `correlationId` plus `trace_id` / `span_id`.

## Scripts

```bash
pnpm --filter @talent-ai/notification-service dev
pnpm --filter @talent-ai/notification-service build
pnpm --filter @talent-ai/notification-service test
```

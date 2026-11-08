# Stale analytics projections

Alerts: `TalentAnalyticsProjectionStale`, `TalentAnalyticsEventsStalled`.

## Triage

1. Open **Rewards, Notifications & Analytics Health** and
   **Domain Events & RabbitMQ**.
2. Check projection throughput and lag:
   ```promql
   sum by (event_type) (rate(talent_analytics_events_processed_total[15m]))
   histogram_quantile(0.95,
     sum by (le) (rate(talent_analytics_projection_lag_seconds_bucket[10m]))
   )
   ```
3. Check the analytics queue:
   ```promql
   rabbitmq_queue_messages_ready{queue="analytics-service.all-events"}
   ```
4. Inspect analytics-service logs for:
   - PostgreSQL connection/Prisma errors,
   - missing migrations (`db:deploy` not run),
   - unique-constraint failures on `processed_events`, or
   - payload validation errors.
5. Confirm `processed_events` is advancing:
   ```sql
   SELECT max(processed_at), count(*) FROM processed_events;
   ```

## Common causes

| Symptom | Check |
| :--- | :--- |
| No processed events, queue grows | Consumer stopped, crashed, or is not subscribed. |
| Lag rises but events process | Analytics DB slow, missing indexes, or lock contention. |
| One event type consistently fails | Contract change; compare with `packages/shared-types/src/events.ts` and the consumer switch. |
| Gaps after a deploy | Migration not applied; run `pnpm --filter @talent-ai/analytics-service db:deploy`. |

## Recovery

1. Scale the consumer:
   ```bash
   kubectl -n talent-ai scale deploy/analytics-service --replicas=3
   ```
2. Restart only after checking logs for a poison message; otherwise it will
   redeliver and fail again.
3. If the read models are known to be stale but events already drained, replay
   the source events or rebuild the affected projections from the seeders/event
   history in a controlled environment.
4. Do not truncate `processed_events` while consumers are running; that breaks
   idempotency and double-applies events.

## Verification

- `talent_analytics_events_processed_total` increases again.
- p95 projection lag is below 300 seconds.
- Queue ready/unacked depth drains.
- Funnel panels (`talent-conversion-funnels`) resume updating.

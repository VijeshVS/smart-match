# Queue backlog and dead-letter queue

Alerts: `TalentEventHandlerFailures`, `TalentQueueBacklog`,
`TalentConsumerLag`, `TalentDeadLetterGrowth`, `TalentDeadLetterNotEmpty`.

## Triage

1. Open **Domain Events & RabbitMQ**.
2. Find the queue and event type:
   ```promql
   sum by (queue) (rabbitmq_queue_messages_ready)
   sum by (queue) (rabbitmq_queue_messages_unacked)
   sum by (service, event_type) (
     rate(talent_domain_events_consumed_total{outcome="failure"}[5m])
   )
   ```
3. Inspect the consumer logs for the failing `eventType`, `eventId` and
   `correlationId`. The event bus logs these before nacking to the DLQ.
4. List queues and DLQ depth:
   ```bash
   docker compose -f infrastructure/docker/docker-compose.infra.yml \
     exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged
   ```

## Common causes

| Symptom | Likely cause |
| :--- | :--- |
| One event type nacked repeatedly | Payload contract change or validation bug. Compare the event with `packages/shared-types/src/events.ts`. |
| All consumers of one service fail | Service crash, bad DB credentials, migration missing, or dependency down. |
| Ready queue grows, no failures | Producer rate exceeds consumer capacity, or consumers are scaled to zero. |
| DLQ grows in bursts | Poison message or a downstream data constraint (for example a duplicate key). |

## Recovery

1. Fix the consumer or data before replaying; replaying into the same bug
   refills the DLQ.
2. Scale consumers:
   ```bash
   kubectl -n talent-ai scale deploy/analytics-service --replicas=3
   ```
3. Replay the DLQ deliberately, preserving the original `eventType` routing key.
   Use the RabbitMQ management UI's **Get messages / Requeue** or a reviewed
   script. Never purge the DLQ until the events have been triaged.
4. For a poison message, copy its body and headers somewhere safe, then purge
   only that message.

## Verification

- Failure rate returns to 0.
- Ready + unacked depth trends down.
- DLQ depth stays flat (growth alert resolves).
- Analytics/rewards projections catch up (see the analytics runbook).

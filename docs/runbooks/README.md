# Runbooks

Phase 11 alert runbooks. Every alert annotation in
`infrastructure/docker/prometheus/rules/talent-ai.yml` links to one of these.

| Runbook | Alerts |
| :--- | :--- |
| [service-health](service-health.md) | `TalentServiceDown`, `TalentHighErrorRate`, `TalentHighLatencyP95`, `TalentErrorBudgetBurn` |
| [database-connectivity](database-connectivity.md) | `TalentServiceDependencyDown` |
| [queue-backlog-dlq](queue-backlog-dlq.md) | `TalentEventHandlerFailures`, `TalentQueueBacklog`, `TalentConsumerLag`, `TalentDeadLetterGrowth`, `TalentDeadLetterNotEmpty` |
| [ai-provider-failures](ai-provider-failures.md) | `TalentAiProviderFailures`, `TalentAiCircuitOpen`, `TalentAiCacheHitRateLow` |
| [rewards-and-notifications](rewards-and-notifications.md) | `TalentRewardsApiErrors`, `TalentRewardsSagaFailure`, `TalentNotificationEmailFailures` |
| [stale-analytics-projections](stale-analytics-projections.md) | `TalentAnalyticsProjectionStale`, `TalentAnalyticsEventsStalled` |

## First five minutes

1. Open the **Platform Overview** and **Service Health** dashboards, filtered to
   the alerting `service` and `env`.
2. Check `up{job="talent-services"}` and the dependency exporters.
3. Correlate the incident start with deploys, migrations and traffic changes.
4. Keep a timeline in the incident channel; capture the dashboard time range and
   affected `correlationId`s before they age out.

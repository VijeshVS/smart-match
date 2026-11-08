# Phase 11 — observability and realistic seeding

Phase 11 turns the existing `/metrics` endpoints and Jaeger traces into an
operable platform:

- Six version-controlled Grafana dashboards, provisioned automatically in Docker
  Compose **and** Kubernetes.
- Prometheus recording and alerting rules covering availability, RED metrics,
  domain-event health, AI providers, rewards/notifications and analytics.
- A deterministic cross-store seeder (`pnpm db:seed:realistic`) so the
  dashboards and funnels show realistic activity on a fresh environment.

## Source of truth

```text
scripts/generate-grafana-dashboards.mjs          # generator
infrastructure/docker/grafana/dashboards/*.json # deployable dashboards
infrastructure/docker/prometheus/prometheus.yml # Compose scrape config
infrastructure/docker/prometheus/rules/*.yml    # recording + alert rules
infrastructure/docker/grafana/provisioning/     # datasource + provider config
infrastructure/k8s/observability/               # Prometheus + Grafana manifests
infrastructure/kustomization.yaml               # Compose/K8s shared ConfigMaps
```

Do not hand-edit the dashboard JSON. Change the generator and run:

```bash
pnpm dashboards:generate
```

The generated files are the same files mounted by Compose and embedded into the
Kubernetes ConfigMap by `infrastructure/kustomization.yaml`.

## Dashboards

| UID | Dashboard | Primary signals |
| :--- | :--- | :--- |
| `talent-platform-overview` | Platform Overview | Request rate, error ratio, p95 latency, service/queue health, event throughput. |
| `talent-service-health` | Service Health, RED & Saturation | Per-route RED metrics, status codes, CPU, memory, event-loop lag, scrape health. |
| `talent-conversion-funnels` | Candidate & Recruiter Conversion Funnels | Candidate/recruiter funnel stages, time-to-match, skill supply/demand from `talent_analytics`. |
| `talent-ai-talentlens` | AI & TalentLens | Provider outcomes, provider latency, circuit state, cache hit rate, TalentLens outcomes, fallbacks. |
| `talent-events-rabbitmq` | Domain Events & RabbitMQ | Publish/consume rates, handler failures, processing latency, queue depth, DLQ. |
| `talent-rewards-notifications-analytics` | Rewards, Notifications & Analytics Health | Ledger types, saga outcomes, notification/email status, projection throughput and lag. |

Every dashboard exposes the `env` and `service` variables, plus
`route`/`status_code` or `event_type` where relevant. The default time range is
6 hours and the default rate window is `5m`.

### Docker Compose

```bash
pnpm infra:up
pnpm obs:up            # jaeger + prometheus + grafana only
open http://localhost:3100
open http://localhost:9090/alerts
```

Compose mounts `prometheus/rules/` and `grafana/dashboards/` read-only, so a
`git pull` plus a container restart is enough to pick up changes.

### Kubernetes

```bash
kubectl apply -k infrastructure          # app + observability
kubectl -n talent-ai get pods,svc
kubectl -n talent-ai port-forward svc/grafana 3100:3000
kubectl -n talent-ai port-forward svc/prometheus 9090:9090
```

`infrastructure/kustomization.yaml` generates the
`talent-ai-grafana-dashboards` and `talent-ai-prometheus-rules` ConfigMaps from
the Compose files, so there is no copy to drift. Create the Grafana admin secret
from `infrastructure/k8s/secret.grafana.example.yaml` and add the analytics
datasource credentials to `talent-ai-secrets`.

## Alerts and runbooks

All alert annotations link to the runbook matching the failure mode.

| Alert | Severity | Runbook |
| :--- | :--- | :--- |
| `TalentServiceDown` | critical | [service-health](runbooks/service-health.md) |
| `TalentServiceDependencyDown` | critical | [database-connectivity](runbooks/database-connectivity.md) |
| `TalentHighErrorRate` | critical | [service-health](runbooks/service-health.md) |
| `TalentHighLatencyP95` | warning | [service-health](runbooks/service-health.md) |
| `TalentErrorBudgetBurn` | critical | [service-health](runbooks/service-health.md) |
| `TalentEventHandlerFailures` | critical | [queue-backlog-dlq](runbooks/queue-backlog-dlq.md) |
| `TalentQueueBacklog` | warning | [queue-backlog-dlq](runbooks/queue-backlog-dlq.md) |
| `TalentConsumerLag` | warning | [queue-backlog-dlq](runbooks/queue-backlog-dlq.md) |
| `TalentDeadLetterGrowth` | critical | [queue-backlog-dlq](runbooks/queue-backlog-dlq.md) |
| `TalentDeadLetterNotEmpty` | warning | [queue-backlog-dlq](runbooks/queue-backlog-dlq.md) |
| `TalentAiProviderFailures` | warning | [ai-provider-failures](runbooks/ai-provider-failures.md) |
| `TalentAiCircuitOpen` | critical | [ai-provider-failures](runbooks/ai-provider-failures.md) |
| `TalentAiCacheHitRateLow` | warning | [ai-provider-failures](runbooks/ai-provider-failures.md) |
| `TalentRewardsApiErrors` | critical | [rewards-and-notifications](runbooks/rewards-and-notifications.md) |
| `TalentRewardsSagaFailure` | critical | [rewards-and-notifications](runbooks/rewards-and-notifications.md) |
| `TalentNotificationEmailFailures` | warning | [rewards-and-notifications](runbooks/rewards-and-notifications.md) |
| `TalentAnalyticsProjectionStale` | warning | [stale-analytics-projections](runbooks/stale-analytics-projections.md) |
| `TalentAnalyticsEventsStalled` | critical | [stale-analytics-projections](runbooks/stale-analytics-projections.md) |

Recording rules `talent:http_request_rate5m`, `talent:http_error_ratio5m`,
`talent:http_latency_p95_5m` and `talent:event_failure_ratio5m` keep alert
queries cheap and consistent with the dashboards.

## Metric catalogue

All service metrics carry `service` and `env` default labels.

| Metric | Type | Labels | Emitted by |
| :--- | :--- | :--- | :--- |
| `http_requests_total` | counter | `method`, `route`, `status_code` | Every HTTP service |
| `http_request_duration_seconds` | histogram | `method`, `route`, `status_code` | Every HTTP service |
| `talent_domain_events_published_total` | counter | `event_type` | Event-bus publisher |
| `talent_domain_events_consumed_total` | counter | `event_type`, `outcome` | Event-bus consumer |
| `talent_domain_event_processing_seconds` | histogram | `event_type`, `outcome` | Event-bus consumer |
| `talent_ai_provider_requests_total` | counter | `provider`, `outcome` | ai-matching-service |
| `talent_ai_provider_request_duration_seconds` | histogram | `provider`, `outcome` | ai-matching-service |
| `talent_ai_cache_requests_total` | counter | `cache`, `result` | ai-matching-service |
| `talent_ai_circuit_breaker_state` | gauge | `breaker` (`0` closed, `1` half-open, `2` open) | ai-matching-service |
| `talent_ai_talent_lens_searches_total` | counter | `outcome` | ai-matching-service |
| `talent_rewards_ledger_transactions_total` | counter | `type` | rewards-service |
| `talent_rewards_saga_total` | counter | `saga`, `outcome` | rewards-service |
| `talent_notifications_created_total` | counter | `type`, `delivery_status` | notification-service |
| `talent_notification_email_total` | counter | `status` | notification-service |
| `talent_analytics_events_processed_total` | counter | `event_type` | analytics-service |
| `talent_analytics_projection_lag_seconds` | histogram | `event_type` | analytics-service |

## Realistic data

```bash
pnpm db:seed:realistic            # deterministic upserts across all stores
pnpm db:seed:realistic --dry-run  # validate the dataset only
pnpm db:seed:realistic --reset    # local/development/test only
```

The seeder is documented in
[`tools/realistic-seeder/README.md`](../tools/realistic-seeder/README.md).
It uses reserved `.test` domains, fictitious names and fixed synthetic phone
ranges; production is denied unless `SEED_ALLOW_PRODUCTION=true` and `--reset`
is always blocked in production.

## Verification

```bash
# dashboards are valid JSON with a uid, title and panels
for f in infrastructure/docker/grafana/dashboards/*.json; do
  jq -e '.uid and .title and (.panels | length > 0)' "$f" >/dev/null
done

# Prometheus rules parse (promtool is bundled in the Prometheus image)
docker run --rm -v "$PWD/infrastructure/docker/prometheus:/etc/prometheus" \
  --entrypoint promtool prom/prometheus:v3.1.0 \
  check rules /etc/prometheus/rules/talent-ai.yml

# Compose and Kustomize render cleanly
pnpm stack:config --quiet
kubectl kustomize infrastructure >/dev/null

# seeder guards and dataset validation
pnpm --filter @talent-ai/realistic-seeder test
pnpm db:seed:realistic --dry-run
```

## Known limitations

- The Compose scrape targets assume services run inside the Compose network. If
  a service runs on the host, change its target to
  `host.docker.internal:<port>`.
- Kubernetes scrape targets assume in-cluster Service DNS names for RabbitMQ,
  Qdrant and the exporters. Point them at managed endpoints when those services
  are external.
- Alert delivery (Alertmanager/PagerDuty/Slack) is intentionally out of scope;
  rules and runbooks are in place so a receiver can be added per environment.

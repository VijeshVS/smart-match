# Service health, RED and saturation

Alerts: `TalentServiceDown`, `TalentHighErrorRate`, `TalentHighLatencyP95`,
`TalentErrorBudgetBurn`.

## Triage

1. Open **Service Health, RED & Saturation** and filter `service` to the alert.
2. Confirm scrape health:
   ```promql
   up{job="talent-services"}
   ```
3. Find the failing route:
   ```promql
   sum by (route, status_code) (
     rate(http_requests_total{service="<service>",status_code=~"5.."}[5m])
   )
   ```
4. Check latency by route:
   ```promql
   histogram_quantile(0.95,
     sum by (route, le) (
       rate(http_request_duration_seconds_bucket{service="<service>"}[5m])
     )
   )
   ```
5. Check saturation on the same dashboard: CPU, resident memory and
   `talent_nodejs_eventloop_lag_p99_seconds`.

## Common causes

| Symptom | Check |
| :--- | :--- |
| One route fails, others healthy | Validation bug, upstream payload change, or a single dependency. Inspect logs for that `route` and the `correlationId`. |
| All routes fail | Pod crash/restart, bad config, exhausted DB pool, failed migration. Check `kubectl -n talent-ai describe pod` / `docker compose ps`. |
| Latency rises with CPU | Event-loop blocking, synchronous crypto/JSON, unbounded query. Check slow-query logs and event-loop lag. |
| Errors began at deploy time | Roll back or redeploy the previous image, then bisect. |
| `up == 0` | Pod not ready, `/metrics` blocked, wrong target/port, or scrape network policy. |

## Verification

- `http_requests_total` resumes with 2xx/3xx responses.
- p95 latency is back under the 2s warning threshold.
- No new 5xx samples for at least 10 minutes.

## Escalation

Escalate to the owning service team if the error rate stays above 5% for 15
minutes or a dependency is confirmed unhealthy.

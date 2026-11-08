# AI provider failures

Alerts: `TalentAiProviderFailures`, `TalentAiCircuitOpen`,
`TalentAiCacheHitRateLow`.

## Triage

1. Open **AI & TalentLens** and filter `service="ai-matching-service"`.
2. Identify the provider and outcome:
   ```promql
   sum by (provider, outcome) (
     rate(talent_ai_provider_requests_total[5m])
   )
   histogram_quantile(0.95,
     sum by (provider, le) (
       rate(talent_ai_provider_request_duration_seconds_bucket[5m])
     )
   )
   talent_ai_circuit_breaker_state
   ```
3. Check whether the deterministic local fallback is serving traffic
   (`outcome="skipped"` / fallback logs). TalentLens should stay available with
   lower match quality.
4. Inspect ai-matching-service logs for `ProviderError`, HTTP 401/429/5xx, DNS
   errors and timeouts.

## Common causes

| Symptom | Check |
| :--- | :--- |
| 401/403 | API key rotation, missing secret, wrong provider selected. |
| 429 | Provider quota/rate limit; reduce `AI_MAX_CONCURRENCY` or wait. |
| Timeouts | Provider incident or network egress; check `AI_REQUEST_TIMEOUT_MS`. |
| Circuit open | Repeated failures tripped `AI_CIRCUIT_FAILURE_THRESHOLD`; it resets after `AI_CIRCUIT_RESET_TIMEOUT_MS`. |
| Cache hit rate low | Redis down, TTLs too short, or cache keys varying unexpectedly. |

## Recovery

- Provider outage: leave the circuit breaker closed/open as designed; the local
  fallback keeps search working. Do not disable the breaker to "force" calls.
- Bad key: update the secret and restart the service:
  ```bash
  kubectl -n talent-ai rollout restart deploy/ai-matching-service
  ```
- Redis issue: follow [database-connectivity](database-connectivity.md); cache
  misses alone are not an outage.
- After recovery, confirm the circuit returns to `0` (closed) and provider
  `outcome="success"` resumes.

## Verification

- Failure ratio stays below 20% for 10 minutes.
- `talent_ai_circuit_breaker_state == 0`.
- TalentLens p95 latency and success/empty outcomes are normal.

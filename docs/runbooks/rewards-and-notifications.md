# Rewards and notifications

Alerts: `TalentRewardsApiErrors`, `TalentRewardsSagaFailure`,
`TalentNotificationEmailFailures`.

## Rewards

1. Open **Rewards, Notifications & Analytics Health**.
2. Check API errors by route:
   ```promql
   sum by (route, status_code) (
     rate(http_requests_total{service="rewards-service",status_code=~"5.."}[5m])
   )
   ```
3. Check saga outcomes:
   ```promql
   sum by (saga, outcome) (rate(talent_rewards_saga_total[10m]))
   ```
   `outcome="failed"` means a wallet/ledger transaction or Tier-3 unlock
   rolled back. `outcome="duplicate"` is normal idempotency, and
   `outcome="skipped"` means a deferred swipe (no reward) was consumed.
4. Swipe and review credits are event-driven:
   - `swipe.recorded` → `CREDIT_SWIPE_DECISION` (1 TC for accept/reject).
   - `review.submitted` → `CREDIT_REVIEW_FEEDBACK` (5 TC for candidate feedback).
     The ledger's unique `(type, reference_id)` index makes redelivery, retries and
     decision changes idempotent. A missing award is usually a queue/DLQ problem
     rather than a ledger problem.
5. For a failed unlock, inspect the ledger and grant state:
   ```sql
   SELECT id, recruiter_id, balance, version FROM wallets WHERE recruiter_id = '…';
   SELECT * FROM ledger_transactions WHERE wallet_id = '…' ORDER BY created_at DESC;
   SELECT * FROM talent_access_grants WHERE recruiter_id = '…';
   ```
6. `402 INSUFFICIENT_CREDITS` is a business response, not a platform failure.
   A 500 usually means a Prisma/PostgreSQL problem or an optimistic-lock retry
   exhaustion.

## Notifications

1. Check creation and email status:
   ```promql
   sum by (type, delivery_status) (rate(talent_notifications_created_total[10m]))
   sum by (status) (rate(talent_notification_email_total[10m]))
   ```
2. For local development, `EMAIL_ENABLED=false` makes `status="SKIPPED"` the
   normal outcome. MailHog captures real messages when SMTP is enabled.
3. For `FAILED`, check SMTP configuration, credentials, TLS and provider
   throttling in the notification-service logs.
4. In-app delivery is independent of email; verify the notification document is
   persisted before treating email failures as data loss.

## Verification

- Rewards 5xx ratio below 2%.
- No new `talent_rewards_saga_total{outcome="failed"}` samples.
- Email failure ratio below 10%, or `SKIPPED` only in local development.

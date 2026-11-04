# notification-service

- **Owner:** Arun (`@arun`)
- **Port:** 5007
- **Datastore:** MongoDB (`talent_notif`)
- **Phase:** 7.1
- **Responsibility:** WebSocket in-app notifications and branded talent.ai emails.
  Consumes `review.submitted`, `rewards.coins_awarded` and `rewards.tier3_unlocked`.
  Exposes notification history and read-state APIs.

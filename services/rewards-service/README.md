# rewards-service

- **Owner:** Arun (`@arun`)
- **Port:** 5005
- **Datastore:** PostgreSQL (`talent_rewards`)
- **Phase:** 5
- **Responsibility:** ACID TalentCredits wallet + immutable ledger, Tier-3 unlock Saga with
  optimistic locking and compensating rollback, and subscription-based access grants.
  Consumes `review.submitted`; publishes `rewards.coins_awarded` and
  `rewards.tier3_unlocked`.

# talent-service

- **Owner:** Arun (`@arun`)
- **Port:** 5002
- **Datastore:** MongoDB (`talent_profiles`)
- **Phase:** 2
- **Responsibility:** Candidate profile aggregate (`TalentProfile`, `Education`,
  `WorkExperience`, Verified Talent Tiers). Owns the transactional outbox for
  `talent.profile.created` and `talent.profile.updated`. Swipes and reviews are explicitly
  excluded — they belong to `engagement-service`.

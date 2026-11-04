# engagement-service

- **Owner:** Arun (`@arun`)
- **Port:** 5004
- **Datastore:** PostgreSQL (`talent_engagement`)
- **Phase:** 4
- **Responsibility:** TalentSwipe decisions and candidate reviews/feedback. Unique
  `(recruiterId, talentId)` swipe constraint. Publishes `swipe.recorded` and
  `review.submitted`.

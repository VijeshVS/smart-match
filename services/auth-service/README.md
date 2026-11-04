# auth-service

- **Owner:** Vijesh (`@vijesh`)
- **Port:** 5001
- **Datastore:** PostgreSQL (`talent_auth`)
- **Phase:** 1.2
- **Responsibility:** Identity & access management — `User`, `Role`, `RefreshToken`,
  `AuditLog`; Argon2id password hashing; 15m access tokens and 7d sliding refresh tokens;
  RBAC claims; publishes `auth.user_registered`.

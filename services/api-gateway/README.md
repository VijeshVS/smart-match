# api-gateway

- **Owner:** Vijesh (`@vijesh`)
- **Port:** 8080
- **Datastore:** Redis (rate limiting, sessions)
- **Phase:** 1.3
- **Responsibility:** Single edge entry point (`api.talent.ai`), JWT verification,
  correlation-id injection, Redis token-bucket rate limiting, CORS, circuit-broken routing
  to every domain service, and the unified `{ status, error: { code, message, correlationId } }`
  error envelope.

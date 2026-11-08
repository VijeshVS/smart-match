# Scripts

| Script | Phase | Purpose |
| :--- | :--- | :--- |
| `audit-rebrand.mjs` | 0.3 | Fails the build if legacy brand names leak into shipped code. Run with `pnpm rebrand:audit`. |
| `generate-grafana-dashboards.mjs` | 11 | Regenerates the six provisioned Grafana dashboards. Run with `pnpm dashboards:generate`; commit the emitted JSON. |
| `migrate-monolith-to-microservices.mjs` | 10.1 | Stub for the legacy data migration. Run with `pnpm db:migrate:seed`. |

# talent.ai

> **Intelligent Hiring & Career Acceleration at the Speed of Thought**

talent.ai is an AI-native hiring platform built for both sides of the market.
Candidates get verified profile insights, structured feedback, and a faster path
to the right role. Recruiters get a focused review workflow, natural-language
talent search, and quality signals that replace manual screening.

---

## What talent.ai does

### For candidates

- Build a verified profile with skills, experience, education, and portfolio links.
- Track profile outcomes, recruiter feedback, and readiness in a personal dashboard.
- Receive AI-generated profile summaries and concrete suggestions to improve
  discoverability and hiring odds.
- Progress through **Verified Talent Tiers** that make seniority legible to
  recruiters without exposing internal level numbers.

### For recruiters

- Review candidates quickly with **TalentSwipe™** — accept, reject, or defer with
  structured feedback.
- Describe a role in plain language and let **TalentLens™** surface the most
  relevant verified profiles.
- Earn **TalentCredits (TC)** for actionable reviews and spend them on Elite
  Principal profile unlocks or platform access.
- Reach high-signal talent without manual filter construction or noisy inbound
  pipelines.

### Product vocabulary

| Concept | Description |
| :--- | :--- |
| **TalentSwipe™** | Swipe-based candidate review with structured feedback. |
| **TalentLens™** | Natural-language semantic search over the verified talent pool. |
| **Verified Talent Tiers** | Junior Fellow, Pro Engineer, and Elite Principal proficiency bands. |
| **TalentCredits (TC)** | Participation currency earned through reviews and spent on profile unlocks. |

---

## Architecture

talent.ai runs as a **pnpm + Turborepo monorepo** with two React portals and a
set of independently deployable Node.js services. Services own their data
(database-per-service) and communicate through REST at the edge or the
`talent.events.topic` RabbitMQ exchange for asynchronous workflows.

```text
candidate-portal ─┐
                  ├─→ api-gateway ─→ auth-service
recruiter-portal ─┘               ├─→ talent-service
                                  ├─→ recruiter-service
                                  ├─→ engagement-service
                                  ├─→ rewards-service
                                  ├─→ ai-matching-service
                                  ├─→ notification-service
                                  └─→ analytics-service
```

### Services

| Service | Port | Datastore | Status |
| :--- | :--- | :--- | :--- |
| `api-gateway` | 8080 | Redis | Implemented |
| `auth-service` | 5001 | PostgreSQL (`talent_auth`) | Implemented |
| `talent-service` | 5002 | MongoDB (`talent_profiles`) | Implemented |
| `recruiter-service` | 5003 | PostgreSQL (`talent_recruiter`) | Implemented |
| `engagement-service` | 5004 | PostgreSQL (`talent_engagement`) | Planned |
| `rewards-service` | 5005 | PostgreSQL (`talent_rewards`) | Planned |
| `ai-matching-service` | 5006 | Qdrant + Redis | Planned |
| `notification-service` | 5007 | MongoDB (`talent_notif`) | Planned |
| `analytics-service` | 5008 | PostgreSQL / ClickHouse | Planned |

> `auth-service` and `api-gateway` are the reference implementations. Each new
> service follows the same package, observability, Docker, and Kubernetes
> patterns.

### Shared packages

| Package | Purpose |
| :--- | :--- |
| `@talent-ai/ui` | Brand tokens, Tailwind preset, and shared React components. |
| `@talent-ai/shared-types` | Cross-service contracts, route prefixes, and event names. |
| `@talent-ai/logger` | Pino logger with correlation ID and `trace_id` / `span_id` injection. |
| `@talent-ai/event-bus` | RabbitMQ publisher/consumer helpers and event envelopes. |
| `@talent-ai/observability` | OpenTelemetry tracing, Prometheus metrics, and secret loading. |

### Platform foundations

- **Security** — Argon2id password hashing, short-lived JWT access tokens,
  rotating refresh tokens, RBAC claims, Helmet headers, Zod validation, edge
  rate limiting, and per-downstream circuit breakers.
- **Reliability** — transactional outbox for user-registration events, Redis
  token buckets, health probes, and graceful shutdown.
- **Observability** — OTLP traces to Jaeger, Prometheus metrics, structured
  logs, and a provisioned Grafana dashboard.
- **Delivery** — multi-stage Docker images, a unified Compose stack, Kubernetes
  manifests with HPA and ingress, and GitHub Actions pipelines that build and
  push images to GHCR.

---

## Tech stack

| Layer | Technology |
| :--- | :--- |
| Portals | React, TypeScript, Vite, Tailwind CSS |
| Services | Node.js, Express, TypeScript |
| Data | PostgreSQL, MongoDB, Redis, Qdrant |
| Messaging | RabbitMQ (`talent.events.topic`) |
| AI | Gemini / Groq / OpenAI provider integrations |
| Observability | OpenTelemetry, Jaeger, Prometheus, Grafana |
| Delivery | Docker, Docker Compose, Kubernetes, GitHub Actions, GHCR |
| Tooling | pnpm, Turborepo, Prisma, Vitest, ESLint, Prettier |

---

## Repository layout

```text
talent.ai/
├── apps/
│   ├── candidate-portal/     # Candidate-facing React app (port 3000)
│   └── recruiter-portal/     # Recruiter-facing React app (port 3001)
├── services/
│   ├── api-gateway/          # Edge routing, auth, rate limits, circuits
│   ├── auth-service/         # Identity, RBAC, JWT, refresh sessions
│   └── …                     # Domain services (see table above)
├── packages/
│   ├── ui/                   # Brand system and shared components
│   ├── shared-types/         # Contracts and event definitions
│   ├── logger/               # Structured logging
│   ├── event-bus/            # RabbitMQ helpers
│   └── observability/        # Tracing, metrics, secrets
├── infrastructure/
│   ├── docker/               # Compose stacks, Prometheus, Grafana, Dockerfile
│   └── k8s/                  # Kubernetes manifests and kustomization
├── docs/                     # Brand and platform documentation
├── TODO.md                   # Phase-by-phase delivery roadmap
└── docker-compose.yml        # Unified infrastructure + application stack
```

---

## Getting started

### Prerequisites

- **Node.js** 20 or newer (CI uses Node 22)
- **pnpm** 10
- **Docker** with Compose v2

### 1. Install and configure

```bash
pnpm install
cp .env.example .env
```

Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to values of at least 32
characters. Never commit `.env`; it is gitignored.

### 2. Start backing services

```bash
pnpm infra:up
```

This starts PostgreSQL, MongoDB, Redis, RabbitMQ, Qdrant, MailHog, Jaeger,
Prometheus, and Grafana.

### 3. Prepare the auth database

```bash
pnpm db:auth:generate
pnpm db:auth:migrate
pnpm db:auth:seed
```

### 4. Run the platform

```bash
# API gateway + auth, talent and recruiter services
pnpm dev:services

# Candidate and recruiter portals
pnpm dev:apps

# Everything together
pnpm dev
```

Or run the containerized stack:

```bash
pnpm stack:up      # build and start infrastructure + services
pnpm stack:logs
pnpm stack:down    # preserves named volumes
```

### Local endpoints

| Surface | URL |
| :--- | :--- |
| Candidate portal | <http://localhost:3000> |
| Recruiter portal | <http://localhost:3001> |
| API gateway | <http://localhost:8080> |
| Auth service | <http://localhost:5001> |
| Talent service | <http://localhost:5002> |
| Recruiter service | <http://localhost:5003> |
| Jaeger UI | <http://localhost:16686> |
| Prometheus | <http://localhost:9090> |
| Grafana | <http://localhost:3100> |

---

## Quality and operations

```bash
pnpm build         # build every workspace package
pnpm lint          # type-aware linting
pnpm typecheck     # TypeScript project checks
pnpm test          # Vitest suites
pnpm format:check  # Prettier verification
```

Every service exposes:

- `GET /health/liveness` — process liveness
- `GET /health/readiness` — datastore and broker connectivity
- `GET /metrics` — Prometheus counters, latency histograms, in-flight gauge

Deployment assets live in [`infrastructure/docker`](infrastructure/docker/README.md)
and [`infrastructure/k8s`](infrastructure/k8s/README.md). The CI matrix builds
and publishes service images to GHCR on `main` and version tags.

---

## Documentation

| Document | Contents |
| :--- | :--- |
| [`TODO.md`](TODO.md) | Phase-by-phase delivery roadmap and ownership. |
| [`docs/BRAND_GUIDELINES.md`](docs/BRAND_GUIDELINES.md) | Brand, product vocabulary, colour, and UI rules. |
| [`services/README.md`](services/README.md) | Service catalogue and observability contract. |
| [`infrastructure/docker/README.md`](infrastructure/docker/README.md) | Local stacks, image builds, and observability endpoints. |
| [`infrastructure/k8s/README.md`](infrastructure/k8s/README.md) | Cluster deployment and service template. |

---

## Roadmap

talent.ai is delivered in phases. Phase 0 established the monorepo and brand
foundation; Phase 1 delivered the auth service and API gateway; Phase 2 delivered
the talent profile service and its transactional outbox; Phase 3 delivered the
recruiter, organization and job-posting service; Phase 9 added observability,
containerization, Kubernetes manifests, and CI/CD. The remaining domain services
and portals follow the plan in [`TODO.md`](TODO.md).

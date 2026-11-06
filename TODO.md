# 🚀 talent.ai — Microservices Transformation & Rebranding Master Plan

> **Project Transformation Roadmap:** Converting the monolithic **Smart Match** recruitment platform into a resilient, event-driven, production-grade **Microservices Architecture**, and executing a full brand overhaul to **talent.ai**.
>
> **Project Directory**: [`./smart-match/`](file:///Users/vijeshshetty/Documents/projects/smart-match/)

---

## 👥 Team Workload & Ownership Matrix

| Engineer | Primary Focus Areas | Owned Microservices & Modules | Key Milestones & Phases |
| :--- | :--- | :--- | :--- |
| **Vijesh**<br/>`@vijesh` | **Platform Architecture, Security, DevOps, Talent/Recruiter/Engagement/Rewards/AI, Notification & Analytics Domains** | • `services/api-gateway`<br/>• `services/auth-service`<br/>• `services/talent-service`<br/>• `services/recruiter-service`<br/>• `services/engagement-service`<br/>• `services/rewards-service`<br/>• `services/ai-matching-service`<br/>• `services/notification-service`<br/>• `services/analytics-service`<br/>• `packages/event-bus`<br/>• Vector DB (`Qdrant`)<br/>• Infrastructure (`Docker`, `K8s`, `RabbitMQ`, `Redis`) | • Phase 0 (Monorepo & Infra setup)<br/>• Phase 1 (Gateway & IAM Auth)<br/>• Phase 2 (Talent Profile Service) ✦ reassigned<br/>• Phase 3 (Recruiter & Org Service) ✦ reassigned<br/>• Phase 4 (Engagement & Review Service) ✦ reassigned<br/>• Phase 5 (Rewards & Sagas) ✦ reassigned<br/>• Phase 6 (AI Engine, Embeddings & TalentLens) ✦ reassigned<br/>• Phase 7 (Notification & Analytics Services) ✦ reassigned<br/>• Phase 9 (Observability, Security & CI/CD)<br/>• Production Deployment |
| **Varenya**<br/>`@varenya` | **Data Migration** | — | • Phase 10.1 (Data Migration Script) |
| **Arun**<br/>`@arun` | **Frontends** | • `apps/candidate-portal`<br/>• `apps/recruiter-portal`<br/>• `packages/ui` & `packages/api-client` | • Phase 0.3 (Brand Assets & UI Tokens)<br/>• Phase 8 (Frontend Portals & Rebrand)<br/>• Phase 10.2 (E2E Integration Tests) |

---

## 📋 Table of Contents
1. [Architecture Overview & Target Topology](#-architecture-overview--target-topology)
2. [Domain-Driven Design (DDD) & Bounded Contexts](#-domain-driven-design-ddd--bounded-contexts)
3. [Rebranding Blueprint: Smart Match → talent.ai](#-rebranding-blueprint-smart-match--talentai)
4. [Microservices Architectural Patterns Implemented](#-microservices-architectural-patterns-implemented)
5. [Target Service Inventory & Database Isolation](#-target-service-inventory--database-isolation)
6. [Phase-by-Phase Implementation Checklist (with Assignees)](#-phase-by-phase-implementation-checklist)
   - [Phase 0: Workspace Setup, Monorepo & Rebranding Foundations](#phase-0-workspace-setup-monorepo--rebranding-foundations)
   - [Phase 1: Infrastructure, API Gateway & IAM / Auth Service](#phase-1-infrastructure-api-gateway--iam--auth-service)
   - [Phase 2: Talent Profile Service (Candidate Domain Extraction)](#phase-2-talent-profile-service-candidate-domain-extraction)
   - [Phase 3: Recruiter & Organization Service](#phase-3-recruiter--organization-service)
   - [Phase 4: Engagement & Review Service (Decoupling Swipes & Feedback)](#phase-4-engagement--review-service-decoupling-swipes--feedback)
   - [Phase 5: Gamification & Rewards Service (Coin Ledger & Subscriptions)](#phase-5-gamification--rewards-service-coin-ledger--subscriptions)
   - [Phase 6: AI & Matching Intelligence Service (Async Worker & Semantic Search)](#phase-6-ai--matching-intelligence-service-async-worker--semantic-search)
   - [Phase 7: Notification & Analytics Services](#phase-7-notification--analytics-services)
   - [Phase 8: Frontend Modernization & talent.ai UI Revamp](#phase-8-frontend-modernization--talentai-ui-revamp)
   - [Phase 9: Observability, Resilience, Security & DevOps](#phase-9-observability-resilience-security--devops)
   - [Phase 10: Data Migration, Integration Testing & Production Cutover](#phase-10-data-migration-integration-testing--production-cutover)
   - [Phase 11: Grafana Dashboards & Realistic Data Seeding](#phase-11-grafana-dashboards--realistic-data-seeding)
   - [Phase 12: Kubernetes Platform Foundation](#phase-12-kubernetes-platform-foundation)
   - [Phase 13: Helm Chart Structure & Release Management](#phase-13-helm-chart-structure--release-management)
   - [Phase 14: Stateful Infrastructure & Persistent Storage](#phase-14-stateful-infrastructure--persistent-storage)
   - [Phase 15: Application Workloads, Networking & Scaling](#phase-15-application-workloads-networking--scaling)
   - [Phase 16: Kubernetes Ingress, Security & Observability](#phase-16-kubernetes-ingress-security--observability)
   - [Phase 17: Single-Command Platform Startup & Operations](#phase-17-single-command-platform-startup--operations)
   - [Phase 18: Kubernetes Validation, Recovery & Production Cutover](#phase-18-kubernetes-validation-recovery--production-cutover)
7. [Distributed Event Catalog & Message Schemas](#-distributed-event-catalog--message-schemas)
8. [Data Migration & Decoupling Strategy](#-data-migration--decoupling-strategy)

---

## 🏛 Architecture Overview & Target Topology

```mermaid
flowchart TD
    subgraph Clients["Frontend Applications (talent.ai)"]
        CP["Candidate Portal<br/>(talent.ai / app.talent.ai)<br/><b>[Owner: Arun]</b>"]
        RP["Recruiter Portal<br/>(recruiter.talent.ai)<br/><b>[Owner: Arun]</b>"]
        AP["Admin Portal<br/>(admin.talent.ai)<br/><b>[Owner: Arun]</b>"]
    end

    subgraph GatewayLayer["Edge & Ingress Layer - [Owner: Vijesh]"]
        AG["API Gateway / Reverse Proxy (Envoy / Traefik / Express Gateway)<br/>- SSL Termination & CORS<br/>- JWT Validation & Claims Injection<br/>- Rate Limiting (Redis Token Bucket)<br/>- Distributed Tracing Context Injection (X-Correlation-ID)"]
    end

    subgraph CoreServices["Domain Microservices"]
        AUTH["Auth & IAM Service<br/><b>[Owner: Vijesh]</b><br/>(Node.js / Express / Argon2)"]
        TALENT["Talent Profile Service<br/><b>[Owner: Vijesh]</b><br/>(Node.js / Mongoose)"]
        REC["Recruiter & Org Service<br/><b>[Owner: Vijesh]</b><br/>(Node.js / Prisma)"]
        ENGAGE["Engagement & Review Service<br/><b>[Owner: Vijesh]</b><br/>(Node.js / Prisma)"]
        REWARDS["Gamification & Rewards Service<br/><b>[Owner: Vijesh]</b><br/>(Coin Ledger & Subscriptions)"]
        AI_SVC["AI Matching & Intelligence Service<br/><b>[Owner: Vijesh]</b><br/>(Node.js / Express / Qdrant / Groq / Gemini)"]
        NOTIF["Notification Service<br/><b>[Owner: Vijesh]</b><br/>(Node.js / WebSockets / Nodemailer)"]
        ANALYTICS["Analytics & Reporting Service<br/><b>[Owner: Vijesh]</b><br/>(Node.js / PostgreSQL)"]
    end

    subgraph EventMesh["Event-Driven Backbone (Async Messaging) - [Owner: Vijesh]"]
        BROKER["Message Broker (RabbitMQ / Apache Kafka)<br/>- Exchange / Topic Topology<br/>- Dead Letter Queues (DLQ)<br/>- Transactional Outbox Pattern"]
    end

    subgraph DataLayer["Database-per-Service Isolation"]
        DB_AUTH[("Auth DB<br/>PostgreSQL")]
        DB_TALENT[("Talent DB<br/>MongoDB")]
        DB_REC[("Recruiter DB<br/>PostgreSQL")]
        DB_ENGAGE[("Engagement DB<br/>PostgreSQL")]
        DB_REWARDS[("Rewards DB<br/>PostgreSQL")]
        DB_AI[("Vector DB / Cache<br/>Qdrant & Redis")]
        DB_NOTIF[("Notification DB<br/>MongoDB")]
        DB_ANALYTICS[("Analytics DB<br/>ClickHouse / PostgreSQL")]
    end

    subgraph Telemetry["Observability & Tracing - [Owner: Vijesh]"]
        OTEL["OpenTelemetry Collector"]
        JAEGER["Jaeger (Distributed Traces)"]
        PROM["Prometheus (Metrics Engine)"]
        GRAFANA["Grafana (Dashboards)"]
    end

    %% Client to Gateway
    CP -->|HTTPS / REST| AG
    RP -->|HTTPS / REST| AG
    AP -->|HTTPS / REST| AG

    %% Gateway to Services
    AG -->|/api/v1/auth| AUTH
    AG -->|/api/v1/talent| TALENT
    AG -->|/api/v1/recruiters| REC
    AG -->|/api/v1/engagement| ENGAGE
    AG -->|/api/v1/rewards| REWARDS
    AG -->|/api/v1/ai| AI_SVC
    AG -->|/api/v1/notifications| NOTIF
    AG -->|/api/v1/analytics| ANALYTICS

    %% Services to DBs
    AUTH --- DB_AUTH
    TALENT --- DB_TALENT
    REC --- DB_REC
    ENGAGE --- DB_ENGAGE
    REWARDS --- DB_REWARDS
    AI_SVC --- DB_AI
    NOTIF --- DB_NOTIF
    ANALYTICS --- DB_ANALYTICS

    %% Async Event Publishing and Consuming
    TALENT -.->|publish: talent.registered, talent.updated| BROKER
    ENGAGE -.->|publish: review.submitted, swipe.recorded| BROKER
    REWARDS -.->|publish: coins.awarded, subscription.unlocked| BROKER
    REC -.->|publish: recruiter.registered, recruiter.job_posted| BROKER

    BROKER -.->|consume: review.submitted| REWARDS
    BROKER -.->|consume: review.submitted, match.found| NOTIF
    BROKER -.->|consume: * all domain events| ANALYTICS
    BROKER -.->|consume: talent.*| AI_SVC

    %% Telemetry Collection
    CoreServices -.->|traces & metrics| OTEL
    OTEL --> JAEGER
    OTEL --> PROM
    PROM --> GRAFANA
```

---

## 🧩 Domain-Driven Design (DDD) & Bounded Contexts

| Bounded Context | Domain Scope | Primary Entities & Aggregates | Target Service | Lead Assignee |
| :--- | :--- | :--- | :--- | :--- |
| **Identity & Access** | Authentication, authorization, token lifecycle, RBAC | `User`, `Account`, `RefreshToken`, `Role`, `Permission` | `auth-service` | **Vijesh** |
| **API Gateway & Routing** | Edge proxy, rate limiting, SSL, token validation, correlation | `GatewayRoute`, `RateLimitRule`, `TokenPayload` | `api-gateway` | **Vijesh** |
| **Talent / Candidate** | Candidate profiles, skills taxonomy, education, work experience, level categorization | `TalentProfile`, `Skill`, `Education`, `WorkExperience`, `TalentLevel` | `talent-service` | **Vijesh** |
| **Recruiter & Org** | Recruiter accounts, company affiliations, hiring criteria, job postings | `Recruiter`, `Organization`, `JobPosting`, `SubscriptionTier` | `recruiter-service` | **Vijesh** |
| **Engagement & Interaction** | Recruiter swipe actions (right/left), review comments, candidate feedback | `SwipeInteraction`, `Review`, `Feedback`, `Decision` | `engagement-service` | **Vijesh** |
| **Gamification & Rewards** | HR coin ledger, coin awards, redemption for tier-3 access, platform subscriptions | `CoinLedger`, `CoinTransaction`, `RewardRule`, `Subscription` | `rewards-service` | **Vijesh** |
| **AI & Matching Intelligence** | Natural language filtering, fit scoring, profile summarization, career recommendations | `MatchEvaluation`, `TalentSummary`, `CareerSuggestion`, `EmbeddingVector` | `ai-matching-service` | **Vijesh** |
| **Notifications** | Async in-app alerts, emails to candidates on review, recruiter match alerts | `Notification`, `NotificationTemplate`, `DeliveryStatus` | `notification-service` | **Vijesh** |
| **Analytics & Reporting** | Funnel conversion, swipe ratios, skill demand metrics, leaderboard | `HiringMetric`, `FunnelAggregate`, `SkillAnalytics` | `analytics-service` | **Vijesh** |
| **Frontend Applications** | Candidate Portal, Recruiter Portal, Shared UI tokens, API client | `WebClient`, `CandidateApp`, `RecruiterApp` | `apps/*` | **Arun** |

---

## 🎨 Rebranding Blueprint: Smart Match → talent.ai

### Brand Identity Matrix
- **Brand Name**: `talent.ai`
- **Tagline**: *"Intelligent Hiring & Career Acceleration at the Speed of Thought"*
- **Candidate Portal Pitch**: *"Accelerate your tech career with AI-driven profile insights and smart matching."*
- **Recruiter Portal Pitch**: *"Discover, evaluate, and hire verified high-signal talent in seconds with AI-assisted review."*
- **Core Feature Renaming**:
  - `Jobify` (Swipe card review) ➔ **TalentSwipe™** (or **QuickMatch**)
  - `Filterify` (Natural language candidate search) ➔ **TalentLens™** (AI Semantic Query)
  - `Level 1 / 2 / 3 Candidates` ➔ **Verified Talent Tiers** (`Junior Fellow`, `Pro Engineer`, `Elite Principal`)
  - `Smart Match Coins` ➔ **TalentCredits (TC)**

### Rebranding Inventory Checklist
- [x] **Domain & Configuration** `[Assignee: Vijesh]`:
  - [x] Replace `smartmatch` in database names, docker network names, container labels, and connection strings.
  - [x] Update frontend environment variables (`VITE_APP_NAME="talent.ai"`, `VITE_SITE_URL="https://talent.ai"`).
- [x] **HTML & Meta Tags** `[Assignee: Arun]`:
  - [x] `apps/candidate-portal/index.html`: Update `<title>talent.ai — Candidate Career Portal</title>`, meta description, OpenGraph tags, and favicon.
  - [x] `apps/recruiter-portal/index.html`: Update `<title>talent.ai — Recruiter & Talent Acquisition Platform</title>`, meta description, OpenGraph tags, and favicon.
- [x] **UI Components & Branding Assets** `[Assignee: Arun]`:
  - [x] Design and generate modern SVG logos for **talent.ai** (dark & light variants, icon-only mark, full wordmark).
  - [x] `apps/candidate-portal/src/components/Layout.tsx`: Update navbar brand text to `talent.`<span className="gradient-text">ai</span>.
  - [x] `apps/recruiter-portal/src/components/Sidebar.tsx`: Update sidebar brand text to `talent.`<span className="gradient-text">ai</span> `Recruiter`.
  - [x] `apps/candidate-portal/src/components/Landing.tsx`: Replace all "Smart Match" copy with "talent.ai".
  - [x] `apps/recruiter-portal/src/pages/Home.tsx`: Replace "Welcome to SmartMatch" with "Welcome to talent.ai".
- [x] **Backend Ping Responses** `[Assignee: Vijesh]`:
  - [x] `candidate/backend/index.js` & `hr/backend/index.js`: Replace root ping responses (`talent.ai API Gateway / Microservice v1.0`).
  - [x] Replace demo mock copy, placeholders, and footer credits to reflect `talent.ai`.

---

## ⚙️ Microservices Architectural Patterns Implemented

1. **Database-per-Service** *(All Engineers)*:
   - Zero cross-service database access. Each service encapsulates its own persistence store.
   - Cross-domain data is queried via REST/gRPC or populated asynchronously via event subscriptions.
2. **API Gateway & Backend-for-Frontend (BFF)** *(Lead: Vijesh)*:
   - Single entry point (`api.talent.ai`) shielding internal microservice network topology.
   - Enforces authentication, request validation, rate limiting, and request routing.
3. **Event-Driven Architecture (EDA)** *(Lead: Vijesh & Arun)*:
   - Asynchronous inter-service communication over RabbitMQ or Kafka using AMQP/Kafka protocols.
   - Domain events decouple heavy workflows (e.g. reward distribution, AI indexing, notifications).
4. **Transactional Outbox Pattern** *(Lead: Vijesh)*:
   - Prevents dual-write inconsistencies between database mutations and message publishing. Events are committed atomically with business transactions into an `outbox` table and relayed to the broker.
5. **Saga Pattern (Orchestration/Choreography)** *(Lead: Arun)*:
   - Distributed transactions for multi-step workflows (e.g. unlocking Elite Tier-3 candidates: check coin balance ➔ reserve coins ➔ grant access ➔ debit coins ➔ emit notification; with rollback on failure).
6. **Circuit Breaker & Graceful Degradation** *(Lead: Vijesh)*:
   - Wraps downstream calls (e.g., Groq / Gemini LLM API, remote microservice calls) with timeouts, error thresholds, and cached fallbacks to prevent cascading failures.
7. **Command Query Responsibility Segregation (CQRS)** *(Lead: Vijesh)*:
   - Write models handle strict transactional consistency (e.g. Candidate Registration, Reviews); Read models provide fast denormalized views for recruiter swipe queues and search.
8. **Distributed Tracing & Correlation IDs** *(Lead: Vijesh)*:
   - OpenTelemetry W3C trace context (`traceparent`, `X-Correlation-ID`) propagated from the API Gateway across every HTTP request and message broker header.

---

## 🗄 Target Service Inventory & Database Isolation

| # | Service Directory | Tech Stack | Port | Database | Primary Responsibility | Assigned Lead |
| :- | :--- | :--- | :- | :--- | :--- | :--- |
| **0** | `services/api-gateway` | Express / Traefik / Envoy | 8080 | Redis (Rate Limiting & Sessions) | Entry point, routing, auth guard, rate limit, CORS | **Vijesh** |
| **1** | `services/auth-service` | Node.js / Express / TypeScript | 5001 | PostgreSQL (`talent_auth`) | User accounts, credentials, JWT issue/refresh, RBAC | **Vijesh** |
| **2** | `services/talent-service` | Node.js / Express / TypeScript | 5002 | MongoDB (`talent_profiles`) | Candidate profile management, resumes, skill tags, tiers | **Vijesh** |
| **3** | `services/recruiter-service` | Node.js / Express / TypeScript | 5003 | PostgreSQL (`talent_recruiter`) | Recruiter profiles, company info, hiring requisitions | **Vijesh** |
| **4** | `services/engagement-service`| Node.js / Express / TypeScript | 5004 | PostgreSQL (`talent_engagement`) | Swipes (approve/reject), reviews, feedback records | **Vijesh** |
| **5** | `services/rewards-service` | Node.js / Express / TypeScript | 5005 | PostgreSQL (`talent_rewards`) | TalentCredits ledger, coins for feedback, unlocks | **Vijesh** |
| **6** | `services/ai-matching-service`| Node.js / Express / TypeScript | 5006 | Qdrant (Vector DB) + Redis | LLM analysis, TalentLens semantic search, summaries | **Vijesh** |
| **7** | `services/notification-service`| Node.js / TypeScript | 5007 | MongoDB (`talent_notif`) | Email alerts, in-app WebSocket notifications | **Vijesh** |
| **8** | `services/analytics-service` | Node.js / TypeScript | 5008 | PostgreSQL (`talent_analytics`) | Telemetry, hiring conversion stats, talent insights | **Vijesh** |
| **9** | `apps/candidate-portal` | React / Vite / Tailwind / TS | 3000 | Client Browser | Rebranded talent.ai candidate web app | **Arun** |
| **10**| `apps/recruiter-portal` | React / Vite / Tailwind / TS | 3001 | Client Browser | Rebranded talent.ai recruiter web app | **Arun** |

---

## 📝 Phase-by-Phase Implementation Checklist

### Phase 0: Workspace Setup, Monorepo & Rebranding Foundations
- [x] **0.1 Monorepo Structuring** `[Assignee: Vijesh]`:
  - [x] Initialize a Turborepo / pnpm workspace structure:
    ```
    talent-ai/
    ├── apps/
    │   ├── candidate-portal/        # Rebranded candidate frontend
    │   └── recruiter-portal/        # Rebranded HR frontend
    ├── services/
    │   ├── api-gateway/             # Gateway & Reverse Proxy
    │   ├── auth-service/            # Authentication & IAM
    │   ├── talent-service/          # Candidate & Talent profile management
    │   ├── recruiter-service/       # Recruiter & Org management
    │   ├── engagement-service/      # Swipes, Reviews & Feedback
    │   ├── rewards-service/         # Coins & Tier-3 Subscriptions
    │   ├── ai-matching-service/     # LLM, Vector Embeddings & Summaries
    │   ├── notification-service/    # WebSockets & Email notifications
    │   └── analytics-service/       # Aggregated dashboards & stats
    ├── packages/
    │   ├── shared-types/            # Shared TypeScript DTOs & Interfaces
    │   ├── event-bus/               # RabbitMQ publisher/consumer wrappers
    │   ├── logger/                  # Structured Pino/Winston logging with tracing
    │   └── ui/                      # Shared Tailwind design tokens & UI library
    ├── infrastructure/
    │   ├── docker/                  # Dockerfiles & Compose files
    │   └── k8s/                     # Kubernetes manifests
    └── scripts/                     # Seeders & data migration scripts
    ```
  - [x] Create root `package.json` with workspace configuration (`workspaces: ["apps/*", "services/*", "packages/*"]`).
  - [x] Configure root `turbo.json` for pipeline caching (`build`, `lint`, `test`, `dev`).
- [x] **0.2 Shared Packages Setup** `[Assignees: Vijesh & Arun]`:
  - [x] `packages/shared-types`: Setup shared TypeScript interfaces for DTOs, Event models, and API responses. `[Assignee: Arun]`
  - [x] `packages/logger`: Setup structured JSON logger (Pino/Winston) with `correlationId` and `serviceName`. `[Assignee: Vijesh]`
  - [x] `packages/event-bus`: Setup RabbitMQ publisher/consumer module with auto-reconnect, Dead-Letter Exchange (DLX), and message typing. `[Assignee: Vijesh]`
- [x] **0.3 Global Rebranding Audit & Asset Preparation** `[Assignee: Arun]`:
  - [x] Design SVG brand assets (`talent-ai-logo.svg`, `talent-ai-mark.svg`, `favicon.svg`).
  - [x] Update color palette variables in Tailwind (`accent-cyan`, `accent-violet`, `talent-primary`, `talent-dark`).
  - [x] Draft unified brand guidelines in `docs/BRAND_GUIDELINES.md`.

---

### Phase 1: Infrastructure, API Gateway & IAM / Auth Service
- [x] **1.1 Base Infrastructure Orchestration** `[Assignee: Vijesh]`:
  - [x] Create `infrastructure/docker/docker-compose.infra.yml` orchestrating:
    - [x] MongoDB replica set (for `talent-service` & `notification-service`).
    - [x] PostgreSQL 16 instance with multi-tenancy/multi-database initialization script (`talent_auth`, `talent_recruiter`, `talent_engagement`, `talent_rewards`).
    - [x] Redis 7 (for distributed sessions, token bucket rate limiting, and caching).
    - [x] RabbitMQ 3.13 with Management UI (exchange: `talent.events.topic`).
    - [x] Qdrant Vector Database (for semantic talent embeddings).
    - [x] MailHog / Inbucket (for local email capture & testing).
- [x] **1.2 Auth & IAM Service (`services/auth-service`)** `[Assignee: Vijesh]`:
  - [x] Implement database schema with Prisma / TypeORM for `User`, `Role`, `RefreshToken`, `AuditLog`.
  - [x] Implement password hashing using Argon2id.
  - [x] Implement JWT token generator (Access Token: 15m expiration; Refresh Token: 7d sliding expiration).
  - [x] Implement auth endpoints:
    - `POST /api/v1/auth/register` (Registers candidate or recruiter with role assignment).
    - `POST /api/v1/auth/login` (Returns JWT access token + HTTP-only refresh cookie).
    - `POST /api/v1/auth/refresh` (Rotates refresh token and returns new access token).
    - `POST /api/v1/auth/logout` (Revokes session in Redis).
    - `GET /api/v1/auth/me` (Returns current user identity and permissions).
  - [x] Publish `auth.user_registered` event to RabbitMQ on new account creation.
- [x] **1.3 API Gateway (`services/api-gateway`)** `[Assignee: Vijesh]`:
  - [x] Implement Express/Fastify API Gateway (or configure Traefik / Envoy reverse proxy).
  - [x] Implement Correlation ID middleware (`X-Correlation-ID`) with UUIDv4 generation if not supplied.
  - [x] Implement JWT Verification Middleware (decodes JWT, validates signature, attaches `X-User-Id`, `X-User-Role`, `X-User-Email` downstream).
  - [x] Implement Distributed Rate Limiter with Redis token-bucket (60 req/min for general routes, 5 req/min for auth/AI routes).
  - [x] Configure route proxy mappings with circuit breakers to downstream microservices.
  - [x] Configure unified CORS handling and central error format (`{ status, error: { code, message, correlationId } }`).

---

### Phase 2: Talent Profile Service (Candidate Domain Extraction)
- [x] **2.1 Decouple Monolithic Candidate Schema** `[Assignee: Vijesh]`:
  - [x] Extract candidate details from monolithic `candidateModel.js`.
  - [x] **Remove** `rightSwipes`, `leftSwipes`, and `reviews` from the Talent Profile entity (these belong strictly to `engagement-service`).
  - [x] Create clean Mongoose / Prisma schema for `TalentProfile`:
    - `id`, `userId` (ref to auth-service), `name`, `email`, `phone`, `field`, `skills` (normalized array), `experienceYears`.
    - `education` sub-documents: `college`, `degree`, `branchOfStudy`, `yearOfGraduation`, `gpa`.
    - `previousExperience` sub-documents: `company`, `role`, `durationMonths`, `responsibilities`.
    - `level`: Enum (`LEVEL_1_ENTRY`, `LEVEL_2_MID`, `LEVEL_3_LEAD`).
    - `bio`, `portfolioUrl`, `linkedinUrl`, `githubUrl`, `resumeUrl`.
- [x] **2.2 Implement Talent Service APIs** `[Assignee: Vijesh]`:
  - [x] `POST /api/v1/talent` — Create candidate profile (validated with Zod).
  - [x] `GET /api/v1/talent/:id` — Fetch candidate profile by ID.
  - [x] `GET /api/v1/talent` — Query candidate profiles with pagination, skills filtering, and level filtering.
  - [x] `PUT /api/v1/talent/:id` — Update candidate profile.
  - [x] `PATCH /api/v1/talent/:id/level` — Update calculated candidate tier.
- [x] **2.3 Event Publishing & Outbox** `[Assignee: Vijesh]`:
  - [x] Implement Transactional Outbox pattern on profile create and update.
  - [x] Publish `talent.profile.created` and `talent.profile.updated` events containing profile payloads for indexing by the AI Matching service.

---

### Phase 3: Recruiter & Organization Service
- [x] **3.1 Recruiter Domain Modeling** `[Assignee: Vijesh]`:
  - [x] Create PostgreSQL schema for `RecruiterProfile`, `Organization`, `JobPosting`.
  - [x] Map recruiter accounts to companies, billing details, and team permissions.
- [x] **3.2 Recruiter Service APIs** `[Assignee: Vijesh]`:
  - [x] `POST /api/v1/recruiters/profile` — Initialize or update recruiter profile.
  - [x] `GET /api/v1/recruiters/me` — Get authenticated recruiter profile and organization context.
  - [x] `POST /api/v1/recruiters/jobs` — Create a new hiring requirement / job listing.
  - [x] `GET /api/v1/recruiters/jobs` — List active job listings for candidate matching.
- [x] **3.3 Event Integration** `[Assignee: Vijesh]`:
  - [x] Publish `recruiter.registered` and `recruiter.job_posted`.

---

### Phase 4: Engagement & Review Service (Decoupling Swipes & Feedback)
- [x] **4.1 Architecture & Schema Design** `[Assignee: Vijesh]`:
  - [x] Build isolated `engagement-service` backed by PostgreSQL (`talent_engagement`).
  - [x] Schema:
    - `swipes` table: `id`, `recruiterId`, `talentId`, `decision` (`APPROVE` | `REJECT`), `createdAt`. Unique constraint on `(recruiterId, talentId)`.
    - `reviews` table: `id`, `swipeId`, `recruiterId`, `talentId`, `rating`, `feedbackText`, `actionableAdvice`, `createdAt`.
- [x] **4.2 Engagement Service APIs** `[Assignee: Vijesh]`:
  - [x] `POST /api/v1/engagement/swipes` — Record swipe action.
  - [x] `POST /api/v1/engagement/reviews` — Submit candidate review and feedback.
  - [x] `GET /api/v1/engagement/talent/:talentId/summary` — Get aggregate swipe counts (`rightSwipes`, `leftSwipes`) and review comments for candidate dashboard.
  - [x] `GET /api/v1/engagement/recruiter/:recruiterId/history` — Get candidate review history for recruiter.
- [x] **4.3 Event Publishing** `[Assignee: Vijesh]`:
  - [x] Emit `swipe.recorded` event: `{ swipeId, recruiterId, talentId, decision, timestamp }`.
  - [x] Emit `review.submitted` event: `{ reviewId, recruiterId, talentId, decision, feedbackText, hasActionableFeedback: boolean }`.

---

### Phase 5: Gamification & Rewards Service (Coin Ledger & Subscriptions)
- [x] **5.1 Transactional Ledger & Wallet Modeling** `[Assignee: Vijesh]`:
  - [x] Build `rewards-service` with PostgreSQL (`talent_rewards`) ensuring strict ACID compliance for financial/coin balance transactions.
  - [x] Schema:
    - `wallets`: `id`, `recruiterId`, `balance` (TalentCredits), `version` (optimistic locking).
    - `ledger_transactions`: `id`, `walletId`, `amount`, `type` (`CREDIT_REVIEW_FEEDBACK`, `DEBIT_TIER3_UNLOCK`, `CREDIT_PURCHASE`), `referenceId`, `description`, `createdAt`.
    - `talent_access_grants`: `id`, `recruiterId`, `talentId`, `tierUnlocked`, `expiresAt`, `createdAt`.
- [x] **5.2 Business Logic & APIs** `[Assignee: Vijesh]`:
  - [x] `GET /api/v1/rewards/wallet` — Get current TalentCredits balance and transaction history.
  - [x] `POST /api/v1/rewards/unlock-tier3` — Unlock Level-3 Elite candidate profile using TalentCredits or active subscription.
  - [x] Implement Saga for unlocking:
    1. Verify wallet balance (>= cost).
    2. Atomically debit coins from wallet with optimistic lock.
    3. Insert access grant record.
    4. Emit `rewards.tier3_unlocked` event.
    5. Trigger compensating rollback transaction if grant fails.
- [x] **5.3 Event Consumption** `[Assignee: Vijesh]`:
  - [x] Subscribe to `review.submitted` from message broker:
    - If `hasActionableFeedback` is true, credit 5 TalentCredits to recruiter wallet.
    - Write immutable ledger entry: `+5 TC (Review Incentive)`.
    - Emit `rewards.coins_awarded` event.

---

### Phase 6: AI & Matching Intelligence Service (Async Worker & Semantic Search)
- [x] **6.1 Refactoring Monolithic LLM Logic** `[Assignee: Vijesh]`:
  - [x] Move LLM calls away from synchronous HTTP request loops (which currently bottleneck `hr/backend/index.js` on `POST /evaluate`).
  - [x] Implement provider abstraction interface (`LLMProvider`: Groq, Google Gemini 1.5 Pro/Flash, OpenAI).
- [x] **6.2 Vector Search & Candidate Embeddings** `[Assignee: Vijesh]`:
  - [x] Integrate Qdrant or pgvector.
  - [x] On `talent.created` or `talent.updated` events, generate dense vector embeddings of candidate skills, experience, and education, storing them in the vector database.
- [x] **6.3 AI Service APIs & Workers** `[Assignee: Vijesh]`:
  - [x] `POST /api/v1/ai/summarize-profile` — Generate structured JSON candidate profile summary points.
  - [x] `POST /api/v1/ai/suggest-improvements` — Generate personalized, actionable career improvement recommendations based on candidate's current skills and reviews.
  - [x] `POST /api/v1/ai/talent-lens` (Formerly Filterify):
    - Converts recruiter's natural language hiring prompt (e.g., *"Looking for senior DevOps with Terraform and AWS experience"*) into vector search + metadata filters.
    - Uses Groq / Gemini for rapid parallel evaluation and scoring of candidate matches.
  - [x] Add Redis caching for repeated evaluation prompts (TTL 1 hour).
  - [x] Implement circuit breaker with fallback responses if AI provider rate limits are exceeded.

---

### Phase 7: Notification & Analytics Services
- [x] **7.1 Notification Service (`services/notification-service`)** `[Assignee: Vijesh]` ✦ reassigned from Arun:
  - [x] Implement WebSocket server (`ws`) for live in-app notifications at `/ws/notifications`, with token auth and a Redis pub/sub fan-out across replicas.
  - [x] Implement email worker with Nodemailer templates branded for **talent.ai** (JSON transport when no SMTP relay is configured).
  - [x] Subscribe to events:
    - `review.submitted` ➔ Send notification to candidate: *"A recruiter reviewed your profile and left feedback!"*.
    - `rewards.coins_awarded` ➔ Send notification to recruiter: *"You earned 5 TalentCredits for your candidate review!"*.
    - `rewards.tier3_unlocked` ➔ Notify candidate that an employer unlocked their full profile.
    - `ai.evaluation.completed` ➔ Notify recruiter of a high-affinity match.
    - `talent.profile.*` / `recruiter.registered` ➔ Maintain contact projections used to address alerts.
  - [x] Store notification history in MongoDB (`talent_notif`) with per-event idempotency.
  - [x] API: `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count` & `PATCH /api/v1/notifications/:id/read`.
- [x] **7.2 Analytics Service (`services/analytics-service`)** `[Assignee: Vijesh]` ✦ reassigned from Varenya:
  - [x] Subscribe to all domain events (`talent.*`, `swipe.*`, `review.*`, `rewards.*`, `ai.*`) through one durable queue.
  - [x] Maintain real-time read models in PostgreSQL (`talent_analytics`):
    - Candidate acceptance vs rejection ratios.
    - Top in-demand skills and average time to match.
    - Recruiter engagement leaderboards.
  - [x] API: `GET /api/v1/analytics/candidate/:id`, `GET /api/v1/analytics/recruiter/dashboard`, `GET /api/v1/analytics/skills`, `GET /api/v1/analytics/leaderboard` & `GET /api/v1/analytics/funnel`.

---

### Phase 8: Frontend Modernization & talent.ai UI Revamp
- [x] **8.1 Architecture & API Client Centralization** `[Assignee: Arun]`:
  - [x] Remove all hardcoded `http://localhost:3000` and `http://localhost:3001` URLs from both frontends.
    - Portal origins now come from `VITE_*` env vars; every backend call flows through the Gateway.
  - [x] Create `packages/api-client` (Axios / TanStack Query) configured with `VITE_API_GATEWAY_URL`.
    - Axios client with typed modules (`auth`, `talent`, `recruiters`, `engagement`, `rewards`, `ai`,
      `notifications`, `analytics`), shared DTOs from `@talent-ai/shared-types`, and a
      `notificationSocketUrl` derived from `VITE_NOTIFICATION_WS_URL`.
  - [x] Add request interceptors to automatically attach JWT bearer token and handle token refresh on 401.
    - Single-flight refresh with request replay, token persistence in `authStore`, and automatic
      sign-out when the refresh token is rejected.
- [x] **8.2 Candidate Portal Modernization (`apps/candidate-portal`)** `[Assignee: Arun]`:
  - [x] Rebrand completely to **talent.ai Candidate Portal**:
    - [x] Update logos, favicons, navbar brand text, page headers, and meta titles.
    - [x] Polish UI with modern glassmorphism, glowing gradients, and responsive layouts.
    - shadcn/ui on Tailwind v4 with a shared dark brand theme, `BrandMark`/`BrandWordmark`,
      motion-safe transitions and mobile-first layouts.
  - [x] `Landing.tsx`: Add genuine auth modal (Login / Sign Up) connected to `auth-service`.
    - `AuthDialog` drives `authApi.login` / `authApi.register`, validates password strength and
      surfaces Gateway errors inline.
  - [x] `Onboarding.tsx`: Connect multi-step wizard to `POST /api/v1/talent` via Gateway.
    - Validated wizard submits the full profile (education, experience, skills) through `talentApi`.
  - [x] `Dashboard.tsx`:
    - [x] Fetch candidate profile from `talent-service`.
    - [x] Fetch swipe counts and reviews from `engagement-service`.
    - [x] Fetch AI summary and career recommendations from `ai-matching-service`.
    - [x] Display real-time notification badge connected to `notification-service` WebSockets.
- [x] **8.3 Recruiter Portal Modernization (`apps/recruiter-portal`)** `[Assignee: Arun]`:
  - [x] Rebrand completely to **talent.ai for Recruiters**:
    - [x] Update logos, favicons, sidebar branding, and hero titles.
  - [x] `Home.tsx`: Add Recruiter Login & Organization selector.
    - Replaced by `AuthPage` (login/register) plus `OrgSetup` and the authenticated `AppShell`,
      which resolves the recruiter's organization from `recruiter-service`.
  - [x] `Jumble.tsx` (Rebrand to **TalentSwipe**):
    - [x] Replace mock swipe endpoints with `engagement-service`.
    - [x] Connect review submission to `engagement-service` and display live TalentCredits earned from `rewards-service`.
    - [x] Restrict Level-3 Elite candidate cards unless unlocked via TalentCredits or active subscription.
    - Implemented in `pages/talent-swipe.tsx` with `ReviewDialog`, shared `WalletProvider` state
      and the `useUnlockedTalent` local grant cache.
  - [x] `Filter.tsx` (Rebrand to **TalentLens**):
    - [x] Connect natural language search bar to `ai-matching-service` (`POST /api/v1/ai/talent-lens`).
    - [x] Display match confidence scores and highlighted candidate key strengths.
    - Implemented in `pages/talent-lens.tsx`.
  - [x] `Candidates.tsx`:
    - [x] Paginated candidate directory with filters by skill, tier, and experience.
    - [x] "Unlock Profile" modal triggering the `rewards-service` unlock Saga.
    - Implemented in `pages/candidates.tsx` with `CandidateCard`, `CandidateDialog` and `UnlockDialog`.

---

### Phase 9: Observability, Resilience, Security & DevOps
- [x] **9.1 Distributed Tracing & Logging** `[Assignee: Vijesh]`:
  - [x] Integrate OpenTelemetry NodeSDK into all microservices.
    - `@talent-ai/observability` is the shared bootstrap. `auth-service` and
      `api-gateway` are wired; future services copy `src/tracing.ts`.
  - [x] Configure trace exporter to Jaeger (`http://jaeger:4318/v1/traces`).
    - OTLP/HTTP with `OTEL_EXPORTER_OTLP_ENDPOINT` (Jaeger all-in-one in Compose).
  - [x] Standardize structured JSON logging across all services using Pino / Winston with `trace_id` injection.
    - `@talent-ai/logger` now stamps `trace_id` / `span_id` from the active span.
- [x] **9.2 Metrics & Health Checks** `[Assignee: Vijesh]`:
  - [x] Add standardized `/health/liveness` and `/health/readiness` probes to every microservice (verifying DB and broker connectivity).
    - Implemented in `auth-service` and `api-gateway`; the same routes are
      required of every new service.
  - [x] Expose Prometheus `/metrics` endpoints (HTTP duration, status codes, active connections).
    - `prom-client` counters, histograms, in-flight gauge and Node process metrics.
  - [x] Provide Grafana dashboard JSON definitions for service health and request rates.
    - `infrastructure/docker/grafana/dashboards/talent-overview.json`.
- [x] **9.3 Security Hardening** `[Assignee: Vijesh]`:
  - [x] Enforce Helmet HTTP security headers across all services and Gateway.
    - Both existing services already use `helmet()`; the shared app template keeps it mandatory.
  - [x] Enable strictly typed input validation schemas with Zod on every endpoint.
    - Existing routes validate with Zod; every new route must follow suit.
  - [x] Manage credentials using Docker secrets / `.env` templates (no secrets committed).
    - `loadSecret()` supports `<NAME>_FILE`; `.env.example` and
      `infrastructure/k8s/secret.example.yaml` hold placeholders only.
- [x] **9.4 Multi-Service Docker Orchestration** `[Assignee: Vijesh]`:
  - [x] Create production-ready `Dockerfile` for each microservice using multi-stage Node/Alpine builds.
    - Generic `infrastructure/docker/Dockerfile.service` (turbo prune + pnpm deploy + tini).
  - [x] Build unified `docker-compose.yml` to spin up the entire ecosystem (Databases, Broker, Gateway, 7 Services, 2 Frontends).
    - Root Compose `include`s the infra and app stacks; `auth-service` and
      `api-gateway` are wired. New services append to `docker-compose.app.yml`.
- [x] **9.5 Kubernetes Manifests (`infrastructure/k8s`)** `[Assignee: Vijesh]`:
  - [x] Deployments, Services, ConfigMaps, and Secret manifests for each microservice.
    - `auth-service` and `api-gateway` are complete; `auth-service.yaml` is the
      documented template for the seven future services.
  - [x] Ingress configuration (Nginx / Traefik Ingress Controller) routing `talent.ai`, `recruiter.talent.ai`, and `api.talent.ai`.
  - [x] Horizontal Pod Autoscaler (HPA) policies based on CPU and memory utilization.
- [x] **9.6 CI/CD Pipelines** `[Assignee: Vijesh]`:
  - [x] GitHub Actions workflow matrix to independently lint, test, build Docker images, and push to container registry (GHCR/ECR).
    - `ci.yml` (lint/typecheck/test/build + image smoke build), `docker.yml`
      (GHCR push on `main`/tags) and `pr-hygiene.yml`.

---

### Phase 10: End to End Testing
- [ ] **End-to-End Automated Testing** `[Assignee: Arun & Vijesh]`:
  - [ ] Postman / Newman or Playwright API collection testing the complete user journey:
    - Candidate register ➔ Complete profile ➔ Get AI summary.
    - Recruiter login ➔ Search with TalentLens ➔ Swipe candidate on TalentSwipe ➔ Submit feedback ➔ Verify TalentCredits awarded ➔ Unlock Level-3 candidate.

---

### Phase 11: Grafana Dashboards & Realistic Data Seeding
- [ ] **11.1 Identify Critical Flows and Observability Signals**:
  - [ ] Document the most important user and platform flows to monitor:
    - Candidate onboarding ➔ profile completion ➔ AI summary and recommendations.
    - Recruiter search ➔ TalentLens evaluation ➔ TalentSwipe decision ➔ review submission.
    - Review submission ➔ TalentCredits award ➔ Level-3 profile unlock Saga.
    - Domain event publishing/consumption ➔ notification delivery and analytics projection updates.
  - [ ] For each flow, define the dashboard parameters and metrics, including request rate, latency percentiles (p50/p95/p99), error rate, saturation, throughput, queue depth, consumer lag, retry/DLQ count, and end-to-end completion rate.
  - [ ] Define business metrics including onboarding completion, TalentLens match rate and duration, approve/reject ratio, review rate, TalentCredits awarded, unlock conversion, notification delivery rate, and analytics projection freshness.
- [ ] **11.2 Create and Provision Grafana Dashboards**:
  - [ ] Create version-controlled Grafana JSON dashboards for:
    - [ ] Platform overview and API Gateway traffic.
    - [ ] Microservice health, RED metrics, database connectivity, and resource saturation.
    - [ ] Candidate and recruiter conversion funnels.
    - [ ] AI/TalentLens latency, provider usage, cache hit rate, failures, and circuit-breaker state.
    - [ ] RabbitMQ events, consumer lag, retries, and DLQs.
    - [ ] Rewards Saga, notifications, and analytics pipeline health.
  - [ ] Configure Prometheus variables and dashboard filters for environment, service, route, status code, event type, and time range.
  - [ ] Add actionable alert rules and runbooks for elevated error rates, latency, failed Sagas, queue backlog, DLQ growth, provider failures, and stale projections.
  - [ ] Provision dashboards automatically in Docker Compose and Kubernetes, and validate them with seeded traffic.
- [ ] **11.3 Enable Realistic Database Seeding**:
  - [ ] Add a documented root command, `pnpm run db:seed:realistic`, to seed representative, privacy-safe real-world data across Auth, Talent, Recruiter, Engagement, Rewards, Notification, Analytics, and Qdrant stores.
  - [ ] Generate realistic distributions for candidates, skills, experience levels, organizations, job postings, swipes, reviews, TalentCredits transactions, notifications, events, analytics aggregates, and embeddings so every critical flow is observable.
  - [ ] Make the seeder deterministic with a configurable seed, idempotent, environment-aware, and safe against production execution; support reset/cleanup only for local and test environments.
  - [ ] Verify referential integrity, event replay behavior, dashboard population, and a complete seeded candidate-to-recruiter journey in the development stack.

---

### Phase 12: Kubernetes Platform Foundation
- [ ] Define supported Kubernetes versions, local cluster options ( kind / minikube / k3d ), cloud cluster assumptions, required CLI tools, storage classes, ingress classes, and minimum node capacity.
- [ ] Establish environment overlays for `dev`, `staging`, and `production` without duplicating manifests; document immutable image tags and environment-specific domains.
- [ ] Create the complete Kubernetes repository structure:
  ```text
  infrastructure/k8s/
  ├── base/
  │   ├── namespaces/
  │   ├── rbac/
  │   ├── config/
  │   ├── workloads/
  │   ├── networking/
  │   ├── policies/
  │   └── kustomization.yaml
  ├── overlays/
  │   ├── dev/kustomization.yaml
  │   ├── staging/kustomization.yaml
  │   └── production/kustomization.yaml
  └── helm/
      └── talent-ai/
  ```
- [ ] Define namespaces for platform services, application services, observability, and data where separation is useful; apply consistent labels, annotations, ownership, and pod security standards.
- [ ] Define RBAC service accounts, Roles, ClusterRoles, RoleBindings, and least-privilege permissions for workloads, metrics collection, secret access, Jobs, and operators.
- [ ] Define ResourceQuota, LimitRange, default priority classes, topology spread constraints, node selectors, tolerations, and pod anti-affinity policies.
- [ ] Add validation for every manifest using `kubectl apply --dry-run=server`, Kubeconform/Kubeval, Helm lint, and rendered-manifest tests.

### Phase 13: Helm Chart Structure & Release Management
- [ ] Create an umbrella Helm chart for the complete platform with reusable subcharts or templates for application services, frontends, infrastructure, and observability.
- [ ] Structure the chart with:
  ```text
  infrastructure/helm/talent-ai/
  ├── Chart.yaml
  ├── Chart.lock
  ├── values.yaml
  ├── values-dev.yaml
  ├── values-staging.yaml
  ├── values-production.yaml
  ├── templates/
  │   ├── _helpers.tpl
  │   ├── namespace.yaml
  │   ├── serviceaccounts.yaml
  │   ├── configmaps.yaml
  │   ├── secrets.yaml
  │   ├── deployments.yaml
  │   ├── statefulsets.yaml
  │   ├── daemonsets.yaml
  │   ├── services.yaml
  │   ├── ingress.yaml
  │   ├── jobs.yaml
  │   ├── cronjobs.yaml
  │   ├── hpa.yaml
  │   ├── pdb.yaml
  │   ├── networkpolicies.yaml
  │   └── servicemonitors.yaml
  └── charts/
  ```
- [ ] Define chart values for image repository/tag/digest, replicas, ports, environment variables, secrets, resources, probes, autoscaling, persistence, affinity, ingress, domains, TLS, and observability.
- [ ] Define Helm dependencies and pinned versions for ingress-nginx, cert-manager, Prometheus/Grafana, OpenTelemetry Collector, RabbitMQ, PostgreSQL, MongoDB, Redis, and Qdrant where self-hosting is selected.
- [ ] Use separate Helm releases for platform dependencies where independent lifecycle management is required; document install, upgrade, rollback, uninstall, and release ordering.
- [ ] Ensure `helm template`, `helm lint`, `helm dependency build`, and rendered YAML validation run in CI for every environment values file.
- [ ] Replace `latest` image tags with CI-produced immutable tags or digests and configure image pull secrets and private registry access.

### Phase 14: Stateful Infrastructure & Persistent Storage
- [ ] Choose managed services versus in-cluster Helm releases for PostgreSQL, MongoDB, Redis, RabbitMQ, Qdrant, and object storage; document the decision and operational ownership for each.
- [ ] For self-hosted dependencies, define production-safe StatefulSets or maintained Helm releases with:
  - [ ] PersistentVolumeClaims, StorageClass selection, volume expansion, filesystem permissions, and encryption at rest.
  - [ ] Headless Services and stable network identities where clustering requires them.
  - [ ] Readiness, liveness, and startup probes that reflect actual service health.
  - [ ] Backup schedules, retention, point-in-time recovery, restore verification, and disaster-recovery runbooks.
  - [ ] Anti-affinity, topology spread, replication, quorum, and graceful termination settings.
- [ ] Configure PostgreSQL databases per service (`talent_auth`, `talent_recruiter`, `talent_engagement`, `talent_rewards`, and `talent_analytics`) with migration and credential separation.
- [ ] Configure MongoDB replica-set initialization and persistent storage for Talent and Notification data.
- [ ] Configure RabbitMQ durable exchanges, queues, bindings, publisher confirms, consumer queues, retry policies, and persistent dead-letter queues.
- [ ] Configure Qdrant collection persistence, API authentication, vector dimension compatibility, snapshots, and re-indexing procedures.
- [ ] Configure Redis persistence/replication according to its role as cache, rate limiter, session store, and notification fan-out bus.
- [ ] Define one-shot Kubernetes Jobs or Helm hooks for database migrations, MongoDB initialization, Qdrant collection initialization, and realistic seed data; make every Job idempotent and environment-gated.

### Phase 15: Application Workloads, Networking & Scaling
- [ ] Create one Deployment per stateless application workload: API Gateway, Auth, Talent, Recruiter, Engagement, Rewards, AI Matching, Notification, Analytics, Candidate Portal, and Recruiter Portal.
- [ ] Treat ReplicaSets as Deployment-managed resources; do not maintain standalone ReplicaSet YAML unless a specific controlled rollout requires it.
- [ ] Define for every Deployment:
  - [ ] Container image, command, ports, environment/config references, secret references, security context, and read-only filesystem where compatible.
  - [ ] Startup, readiness, and liveness probes mapped to `/health/liveness`, `/health/readiness`, and service-specific dependency checks.
  - [ ] CPU/memory requests and limits, graceful termination, preStop hooks, rolling-update strategy, max unavailable, and max surge.
  - [ ] Pod anti-affinity/topology spread and minimum available replicas for service resilience.
- [ ] Define ClusterIP Services for internal service discovery and dedicated external entry points only where required; standardize service names and ports.
- [ ] Define the API Gateway route map for every backend service and ensure internal services are not unintentionally exposed publicly.
- [ ] Define a DaemonSet strategy for node-level agents such as OpenTelemetry host metrics, Fluent Bit/Vector logs, and Node Exporter where those components are selected.
- [ ] Define HPAs using CPU/memory and, where appropriate, custom Prometheus metrics such as request rate, queue depth, or consumer lag; ensure Metrics Server and adapters are installed.
- [ ] Add PodDisruptionBudgets, graceful shutdown, retry behavior, circuit breakers, and event-consumer concurrency limits for highly available services.
- [ ] Define CronJobs for cleanup, token/session maintenance, analytics rollups, backups, DLQ inspection, and scheduled data-quality checks where required.

### Phase 16: Kubernetes Ingress, Security & Observability
- [ ] Deploy and configure an Ingress Controller with TLS termination, HTTP to HTTPS redirects, host/path routing, WebSocket support, body-size limits, timeouts, CORS, and rate-limiting policies.
- [ ] Configure Ingress hosts for `talent.ai`, `recruiter.talent.ai`, and `api.talent.ai`; provision certificates with cert-manager or a documented external certificate process.
- [ ] Add NetworkPolicies for default-deny ingress/egress and explicitly allow gateway-to-service, service-to-database, service-to-broker, metrics scraping, DNS, and telemetry traffic.
- [ ] Store credentials through an external secret manager or sealed/encrypted secrets; never commit plaintext credentials, provider keys, or production values.
- [ ] Apply pod security contexts, non-root users, dropped Linux capabilities, seccomp profiles, image signing/scanning, admission policies, and audit logging.
- [ ] Deploy an OpenTelemetry Collector with separate receivers/exporters for OTLP traces, application metrics, host metrics, Kubernetes object/state metrics, logs, and RabbitMQ/ database telemetry as appropriate.
- [ ] Deploy Prometheus with Kubernetes service discovery or Prometheus Operator, including ServiceMonitor/PodMonitor resources for every application and infrastructure exporter.
- [ ] Deploy Grafana with provisioned Prometheus and tracing data sources, Phase 11 dashboards, alert rules, folders, variables, and persistent storage.
- [ ] Add Node Exporter and kube-state-metrics for node and Kubernetes control-plane/workload metrics; document which metrics are collected by Prometheus versus OTel.
- [ ] Add alerting and runbooks for unavailable pods, crash loops, readiness failures, high latency/errors, HPA saturation, node pressure, PVC exhaustion, broker backlog/DLQs, database failures, and stale analytics projections.

### Phase 17: Single-Command Platform Startup & Operations
- [ ] Create an executable root script, `scripts/start.sh`, as the supported entry point for local, staging, and controlled production bootstrap.
- [ ] Make the script strict and safe (`set -Eeuo pipefail`), with argument parsing for environment, namespace, kube-context, release name, image tag, and optional actions such as `--seed`, `--migrate`, `--destroy`, and `--dry-run`.
- [ ] Have the script verify prerequisites (`kubectl`, `helm`, cluster connectivity, required namespaces, storage classes, ingress controller, and Metrics Server) before changing the cluster.
- [ ] Have the script load the selected values file, validate required environment variables and secret references, and fail before deployment when configuration is incomplete.
- [ ] Implement idempotent ordered operations:
  1. Select and validate the Kubernetes context.
  2. Create or verify namespaces and RBAC.
  3. Install/upgrade Helm dependencies and CRDs.
  4. Create/update secrets through the configured secret mechanism.
  5. Install/upgrade stateful infrastructure and wait for readiness.
  6. Run database and vector-store migration/init Jobs.
  7. Install/upgrade application and frontend workloads.
  8. Install/upgrade ingress, observability, dashboards, and alerts.
  9. Optionally run privacy-safe realistic seed Jobs.
  10. Wait for rollouts and print service URLs, release status, pod status, and useful log commands.
- [ ] Ensure `start.sh` never deletes production resources by default; require explicit confirmation and environment checks for destructive operations.
- [ ] Add companion scripts or commands for `stop`, `status`, `logs`, `rollback`, `migrate`, `seed`, `backup`, and `restore` while keeping `start.sh` the single bootstrap entry point.
- [ ] Document local cluster bootstrap, cloud cluster bootstrap, required secret injection, and expected startup duration.

### Phase 18: Kubernetes Validation, Recovery & Production Cutover
- [ ] Add CI checks for Helm linting, chart dependency locks, Kustomize rendering, schema validation, security scanning, container scanning, and policy compliance.
- [ ] Add ephemeral-cluster smoke tests that execute `scripts/start.sh`, verify every rollout, exercise gateway routes, publish/consume a RabbitMQ event, and validate database persistence.
- [ ] Run end-to-end tests against the Kubernetes environment covering registration, profile creation, AI summary, TalentLens search, swipe, review, rewards, notifications, analytics, and dashboard visibility.
- [ ] Test pod restarts, rolling upgrades, node drain, broker restart, database failover, Qdrant recovery, message redelivery, DLQ handling, and restore from backup.
- [ ] Validate horizontal scaling for HTTP services, WebSocket notification behavior, RabbitMQ consumers, AI concurrency, and analytics idempotency.
- [ ] Define SLOs, error budgets, capacity thresholds, on-call ownership, incident response, and rollback criteria.
- [ ] Perform a production readiness review covering security, cost, backups, observability, secrets, data retention, privacy, and disaster recovery.
- [ ] Execute staged production cutover with smoke tests, migration verification, DNS/TLS activation, rollback checkpoints, and post-deployment monitoring.

---

## 📡 Distributed Event Catalog & Message Schemas

All asynchronous messages flow through the RabbitMQ topic exchange `talent.events.topic` with standardized CloudEvents-compliant JSON envelopes:

```json
{
  "eventId": "uuid-v4",
  "eventType": "talent.profile.created",
  "aggregateId": "talent-id-123",
  "timestamp": "2026-11-03T16:30:00Z",
  "correlationId": "trace-uuid",
  "version": "1.0",
  "data": { ... }
}
```

### Event Routing Table

| Routing Key | Producing Service | Consuming Services | Business Purpose | Primary Handlers |
| :--- | :--- | :--- | :--- | :--- |
| `talent.profile.created` | `talent-service` | `ai-matching-service`, `notification-service`, `analytics-service` | Generate vector embeddings; index contact; update aggregate counts | Producer: **Vijesh**<br/>Consumers: **Vijesh** |
| `talent.profile.updated` | `talent-service` | `ai-matching-service`, `notification-service`, `analytics-service` | Re-index candidate, refresh contact and skill aggregates | Producer: **Vijesh**<br/>Consumers: **Vijesh** |
| `swipe.recorded` | `engagement-service` | `analytics-service` | Track acceptance/rejection funnel metrics | Producer: **Vijesh**<br/>Consumer: **Vijesh** |
| `review.submitted` | `engagement-service` | `rewards-service`, `notification-service`, `analytics-service` | Award TalentCredits to HR; notify candidate | Producer: **Vijesh**<br/>Consumers: **Vijesh** |
| `rewards.coins_awarded` | `rewards-service` | `notification-service`, `analytics-service` | Notify recruiter of wallet credit | Producer: **Vijesh**<br/>Consumers: **Vijesh** |
| `rewards.tier3_unlocked` | `rewards-service` | `talent-service`, `notification-service` | Authorize recruiter view for Elite candidate | Producer: **Vijesh**<br/>Consumer: **Vijesh** |
| `ai.evaluation.completed`| `ai-matching-service`| `notification-service`, `analytics-service` | Notify recruiter of high-affinity candidate match | Producer: **Vijesh**<br/>Consumer: **Vijesh** |

---

## 🔄 Data Migration & Decoupling Strategy

### Current Monolithic Schema (`candidateModel.js`)
```javascript
{
  name, email, phone, field, skills, experience,
  rightSwipes, leftSwipes, reviews, // <-- Coupled Engagement Data
  level, education, previousExperience
}
```

### Decomposed Target Microservices Architecture

```mermaid
classDiagram
    class AuthUser {
        +UUID id
        +String email
        +String passwordHash
        +Enum role
        +DateTime createdAt
    }

    class TalentProfile {
        +UUID id
        +UUID userId
        +String name
        +String phone
        +String field
        +String[] skills
        +Number experience
        +Enum level
        +Education[] education
        +Experience[] previousExperience
    }

    class SwipeRecord {
        +UUID id
        +UUID recruiterId
        +UUID talentId
        +Enum decision
        +DateTime createdAt
    }

    class CandidateReview {
        +UUID id
        +UUID swipeId
        +UUID recruiterId
        +UUID talentId
        +String comment
        +Boolean isActionable
        +DateTime createdAt
    }

    class RecruiterWallet {
        +UUID id
        +UUID recruiterId
        +Number balance
        +Number version
    }

    class LedgerTransaction {
        +UUID id
        +UUID walletId
        +Number amount
        +Enum type
        +String referenceId
    }

    AuthUser "1" -- "1" TalentProfile : owns
    TalentProfile "1" -- "*" SwipeRecord : evaluated in
    SwipeRecord "1" -- "0..1" CandidateReview : has
    RecruiterWallet "1" -- "*" LedgerTransaction : records
```

---

## 🏁 Quick Start Verification

Once the implementation phases begin, verify each microservice locally using:

```bash
# 1. Start core backing infrastructure (Databases, Broker, Redis, Vector DB)
docker compose -f infrastructure/docker/docker-compose.infra.yml up -d

# 2. Run data migration script to decouple existing seed data
pnpm run db:migrate:seed

# 3. Seed privacy-safe, realistic data across all service databases
pnpm run db:seed:realistic

# 4. Start all microservices and frontends in development mode via Turborepo
pnpm run dev

# 5. Access apps:
# Candidate Portal:  http://localhost:3000 (talent.ai)
# Recruiter Portal:  http://localhost:3001 (recruiter.talent.ai)
# API Gateway:       http://localhost:8080 (api.talent.ai)
# RabbitMQ Console:  http://localhost:15672 (guest/guest)
# Jaeger Tracing UI: http://localhost:16686
```

After Phases 12–18 are implemented, the full Kubernetes environment will be
started and verified through the single platform entry point:

```bash
./scripts/start.sh --environment dev
```

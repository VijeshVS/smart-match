# ai-matching-service

Provider-agnostic AI layer, candidate embeddings and TalentLens semantic search
for talent.ai.

- **Owner:** Vijesh (`@vijesh`)
- **Port:** 5006 (`PORT`)
- **Datastore:** Qdrant (vectors) + Redis (response cache)
- **Phase:** 6
- **Gateway prefix:** `/api/v1/ai`

## Responsibilities

- Owns the provider abstraction for Groq, Google Gemini and OpenAI. No other
  service talks to an LLM directly.
- Consumes `talent.profile.created` and `talent.profile.updated`, builds a dense
  embedding from the candidate's skills, experience, education and bio, and
  upserts it into Qdrant.
- Serves profile summaries, career suggestions and TalentLens natural-language
  candidate search.
- Converts a recruiter prompt into a semantic query plus metadata filters
  (skills, level, experience range, field), then reranks candidates with bounded
  parallel provider calls.
- Caches responses in Redis for one hour and degrades to a deterministic local
  engine when a provider is rate-limited, misconfigured or circuit-open.
- Publishes `ai.evaluation.completed` for high-affinity TalentLens matches.

## Request flow

```text
Recruiter prompt
      │
      ▼
LLM query interpretation ──► filters + semantic query
      │
      ▼
Embedding provider ──► Qdrant vector search
      │
      ▼
Bounded parallel LLM reranking (max AI_MAX_CONCURRENCY)
      │
      ▼
Redis cache (1h) + ai.evaluation.completed (top match ≥ threshold)
```

The service never loops through candidates with sequential `await` calls like
the legacy `hr/backend` `/evaluate` endpoint. Retrieval happens in Qdrant and
provider calls run through `mapWithConcurrency`.

## API

All routes require a verified identity. The API Gateway injects `x-user-*`
headers after JWT verification; direct calls may present a bearer token.

| Method | Path | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/ai/summarize-profile` | Candidate, Recruiter, Admin | Structured candidate summary bullets. |
| `POST` | `/api/v1/ai/suggest-improvements` | Candidate, Recruiter, Admin | Personalised career recommendations. |
| `POST` | `/api/v1/ai/talent-lens` | Recruiter, Admin | Natural-language semantic candidate search. |

### Summarize profile

Send an indexed `talentId`, an inline profile, or both. An inline profile wins.

```json
{
  "talentId": "507f1f77bcf86cd799439011"
}
```

```json
{
  "data": {
    "summary": [
      "Ada is a Pro Engineer in Software Engineering with 6 years of experience.",
      "Core skills include React, Node.js, TypeScript and PostgreSQL."
    ],
    "provider": "groq",
    "cached": false,
    "fallback": false
  }
}
```

### Suggest improvements

`reviews` is optional and is used to ground recommendations in recruiter
feedback.

```json
{
  "talentId": "507f1f77bcf86cd799439011",
  "reviews": ["Add measurable impact to your experience bullets"]
}
```

```json
{
  "data": {
    "suggestions": [
      "Add a cloud platform (AWS, Azure or GCP) to your core skills and back it with one deployed project.",
      "Rewrite experience bullets to quantify impact instead of listing duties."
    ],
    "provider": "local",
    "cached": false,
    "fallback": true
  }
}
```

### TalentLens

```json
{
  "query": "Looking for a senior DevOps engineer with Terraform and AWS experience",
  "limit": 10,
  "filters": {
    "minExperienceYears": 5
  }
}
```

`query` is required (3–2000 characters). `limit` defaults to `10` and is capped
at `50`. Explicit `filters` win over values inferred from the prompt. Supported
filters are `skills`, `level`, `minExperienceYears`, `maxExperienceYears` and
`field`.

```json
{
  "data": {
    "query": "Looking for a senior DevOps engineer with Terraform and AWS experience",
    "results": [
      {
        "talentId": "507f1f77bcf86cd799439011",
        "profile": {
          "id": "507f1f77bcf86cd799439011",
          "name": "Ada Lovelace",
          "field": "Software Engineering",
          "skills": ["Terraform", "AWS", "Kubernetes"],
          "experienceYears": 9,
          "level": "LEVEL_3_LEAD"
        },
        "score": 0.91,
        "matchedSkills": ["Terraform", "AWS"],
        "strengths": ["Hands-on Terraform", "Hands-on AWS", "9 years in Software Engineering"],
        "rationale": "Direct overlap with Terraform and AWS and 9 years of platform experience."
      }
    ],
    "cached": false,
    "provider": "groq",
    "fallback": false
  }
}
```

Scores are normalised to `0..1`: `0.55 × Qdrant similarity + 0.45 × provider
rerank score`, filtered by `AI_MIN_MATCH_SCORE`.

## Providers and fallback

| Provider | Chat endpoint | Default model |
| :--- | :--- | :--- |
| `groq` | `api.groq.com/openai/v1/chat/completions` | `openai/gpt-oss-120b` |
| `gemini` | `generativelanguage.googleapis.com/v1beta` | `gemini-1.5-flash` |
| `openai` | `api.openai.com/v1/chat/completions` | `gpt-4o-mini` |
| `local` | in-process deterministic engine | — |

`AI_PROVIDER=auto` (default) picks Groq, then Gemini, then OpenAI based on the
first configured key; with no keys it uses `local`. An explicitly selected
provider without its key fails configuration at boot.

Each provider call is guarded by a per-process circuit breaker
(`AI_CIRCUIT_FAILURE_THRESHOLD`, `AI_CIRCUIT_RESET_TIMEOUT_MS`). When the
breaker opens, or a call fails, the operation returns its deterministic local
answer with `fallback: true` instead of surfacing a 5xx. The local engine is
also the default for offline development and tests.

## Embeddings and Qdrant

- The indexer consumes `talent.profile.created` and `talent.profile.updated`
  from the durable `ai-matching-service.talent-indexer` queue.
- `changedFields` is used to skip re-embedding updates that do not touch
  indexed fields.
- Point ids are deterministic UUIDs derived from the talent id, so at-least-once
  delivery is idempotent.
- Payload fields (`level`, `fieldLower`, `skillsLower`, `experienceYears`) are
  indexed for metadata filtering.
- `EMBEDDING_PROVIDER=local` is a non-negative hash embedding; `openai` and
  `gemini` call their embedding APIs. A Qdrant collection has one fixed
  dimension: changing `EMBEDDING_PROVIDER` / `EMBEDDING_DIMENSIONS` requires a
  new `QDRANT_COLLECTION` name and a reindex.
- The collection is created lazily and its dimension is validated at startup.

## Caching

- Responses are cached in Redis under `ai-matching:v1:<operation>:<sha256>`.
- TTL is `AI_CACHE_TTL_SECONDS` (default `3600`).
- Cache keys include the request payload and the configured provider.
- Redis failures fail open: the request is served without cache.
- Cached responses return `cached: true`.

## Events

| Direction | Routing key | Payload |
| :--- | :--- | :--- |
| Consume | `talent.profile.created` | Indexes the candidate. |
| Consume | `talent.profile.updated` | Re-indexes when indexed fields changed. |
| Publish | `ai.evaluation.completed` | Top TalentLens match when `score ≥ AI_HIGH_AFFINITY_THRESHOLD`. |

Malformed payloads and exhausted Qdrant retries are nacked to the shared
dead-letter queue.

## Configuration

Copy `.env.example` to `.env`, or rely on the repository root `.env`.

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5006` | Listen port. |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST endpoint. |
| `QDRANT_COLLECTION` | `talent_profiles` | Vector collection. |
| `REDIS_URL` | `redis://localhost:6379` | Response cache. |
| `JWT_ACCESS_SECRET` | — | Must match `auth-service` / `api-gateway`. |
| `TRUST_GATEWAY_HEADERS` | `true` | Trust `x-user-*` headers injected at the edge. |
| `AI_PROVIDER` | `auto` | `auto`, `groq`, `gemini`, `openai` or `local`. |
| `AI_MAX_CONCURRENCY` | `4` | Parallel provider calls during reranking. |
| `AI_MAX_RERANK` | `12` | Candidates sent to the reranker. |
| `AI_CACHE_TTL_SECONDS` | `3600` | Redis response TTL. |
| `EMBEDDING_PROVIDER` | `local` | `local`, `openai` or `gemini`. |
| `EMBEDDING_DIMENSIONS` | `384` | Vector size; must match the collection. |

## Observability

- `GET /health/liveness`, `GET /health/readiness` and `GET /metrics` follow the
  platform contract. Readiness reports Qdrant, Redis and RabbitMQ; Qdrant is
  critical.
- OpenTelemetry starts before Express, Redis and Qdrant HTTP calls.
- Every log line carries `correlationId` plus `trace_id` / `span_id`.
- Provider failures and fallbacks are logged with the provider and breaker
  state.

## Scripts

```bash
pnpm --filter @talent-ai/ai-matching-service dev
pnpm --filter @talent-ai/ai-matching-service build
pnpm --filter @talent-ai/ai-matching-service test
```

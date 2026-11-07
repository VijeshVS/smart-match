# Phase 10.1 — Candidate End-to-End Journey Execution

- **Date:** 2026-11-07
- **Repository:** `VijeshVS/talent.ai`
- **Issue:** [#19](https://github.com/VijeshVS/talent.ai/issues/19)
- **Execution mode:** live HTTP requests through the API Gateway + live Playwright browser automation against the candidate portal.
- **Scope compliance:** no Playwright test specs, Newman/Postman collections, CI test jobs, or automated fixtures were added. The one-off Playwright driver lived outside the repository. No commit or push was performed.

## 1. Executive summary

The candidate journey was executed live end-to-end and **all 14 Issue #19 checklist items passed**.

Two code/runtime defects were fixed during execution:

1. **Auth refresh 404** — the root `.env` defined a global `PORT=5001`, which every service loaded. The AI Matching Service won port 5001, so the gateway forwarded `/api/v1/auth/*` to the AI service, which returned 404. The auth service was not listening on 5001.
2. **Onboarding premature save** — on the education step, clicking **Next step** both advanced the step and submitted the form, saving the profile with an empty experience array. The button changed from `type="button"` to `type="submit"` during the same click.

Environment-only fixes were also required because the machine already had unrelated PostgreSQL and MongoDB instances on the standard ports.

## 2. Part A — Runtime issues and root causes

### 2.1 `@tailwindcss/vite` could not be resolved (candidate and recruiter portals)

**Status:** Resolved / verified, no source change needed.

- Both portals declare `@tailwindcss/vite` in `devDependencies`:
  - `apps/candidate-portal/package.json`
  - `apps/recruiter-portal/package.json`
- At inspection, the workspace symlinks existed after the workspace install:
  - `apps/candidate-portal/node_modules/@tailwindcss/vite`
  - `apps/recruiter-portal/node_modules/@tailwindcss/vite`
- Verification:
  - `require.resolve('@tailwindcss/vite')` succeeds from both workspaces.
  - Vite serves the transformed stylesheet successfully:
    - `GET http://localhost:3000/src/index.css` → `200`
    - `GET http://localhost:3001/src/index.css` → `200`
  - Candidate and recruiter dev servers both serve HTML and the transformed stylesheet.

**Root cause:** stale/missing workspace dependency links at the time of the original failure. A workspace install restored the links. No dependency or Vite configuration rewrite was required.

### 2.2 `ApiClientError` was not exported from `packages/api-client/dist/index.js`

**Status:** Resolved / verified, no source change needed.

- `packages/api-client/src/index.ts` exports:
  - `ApiClientError`
  - `toApiClientError`
- The generated dist was stale when the original browser error occurred.
- Rebuilt the package and verified the runtime export:

```bash
pnpm --filter @talent-ai/api-client build
node -e "import('./packages/api-client/dist/index.js').then(m => console.log(typeof m.ApiClientError))"
# function
```

- `packages/api-client/dist/index.js` now contains:
  ```js
  export { api, ApiClientError, toApiClientError, subscribeToAuth } from './http.js';
  ```
- `packages/api-client/dist/http.js` contains the `ApiClientError` class.

**Root cause:** stale generated `dist` output. Rebuilding the API client regenerated the public export surface.

### 2.3 API Gateway was unreachable on port 8080

**Status:** Resolved / verified, no code change needed.

- The gateway was not serving at the start of the original session.
- It was restarted as part of the local stack and is now healthy:
  - `GET http://localhost:8080/health/liveness` → `200`
  - `GET http://localhost:8080/health/readiness` → `200`
- Readiness reports `redis: up` and closed circuit breakers for auth, talent, and AI services.

**Root cause:** process/startup state, not a routing or code defect.

### 2.4 `POST /api/v1/auth/refresh` returned 404

**Status:** Fixed and verified.

#### Reproduction

Both the gateway and the direct service returned the same 404:

```text
POST http://localhost:8080/api/v1/auth/refresh -> 404
POST http://localhost:5001/api/v1/auth/refresh -> 404
```

The direct health check on port 5001 revealed the actual owner:

```json
{"status":"ok","service":"ai-matching-service","version":"0.1.0"}
```

#### Route mapping inspection

The route mapping itself was correct:

- Gateway route spec: `API_PREFIXES.auth` = `/api/v1/auth` → `config.services.auth` (`AUTH_SERVICE_URL=http://localhost:5001`).
- The gateway dispatcher is mounted at `/` and deliberately preserves the `/api/v1/...` prefix.
- Auth service mount: `app.use('/api/v1/auth', authRouter)`.
- Auth route: `authRouter.post('/refresh', ...)`.

So the request was being forwarded with the correct path. The problem was **which process owned port 5001**.

#### Root cause

The repository-root `.env` contained:

```dotenv
# ── Auth service ────────────────────────────────────────
PORT=5001
```

Every service config loads the repository-root `.env`, and every service schema reads `PORT`:

- auth-service default `5001`
- talent-service default `5002`
- ai-matching-service default `5006`
- etc.

Because `PORT=5001` was global, all services tried to bind 5001. The AI Matching Service won the race, and the auth service could not bind. The gateway forwarded `/api/v1/auth/refresh` to the AI service, which correctly returned `404 NOT_FOUND`.

#### Fix

- Replaced the global `PORT=5001` with the service-specific `AUTH_SERVICE_PORT=5001` in:
  - `.env` (local, gitignored)
  - `.env.example` (tracked)
- The service defaults remain correct, so removing the global override restores:
  - auth → `5001`
  - talent → `5002`
  - AI → `5006`
- Note: the auth service still reads `PORT` and defaults to `5001`; `AUTH_SERVICE_PORT` is the existing Docker Compose host-port convention used by the other services. The fix relies on removing the shared `PORT` override, not on the auth config reading the new variable.
- Existing developer `.env` files that still contain `PORT=5001` must remove that line as well; changing `.env.example` alone does not migrate an existing `.env`. The local `.env` used for this execution was updated.
- Restarted the stack and generated/applied the auth Prisma client and migrations.

#### Verification after fix

| Request | Result |
| --- | --- |
| `POST /api/v1/auth/register` | `201 Created` |
| `POST /api/v1/auth/login` | `200 OK` |
| `POST /api/v1/auth/refresh` with refresh cookie | `200 OK` |
| `POST /api/v1/auth/refresh` without cookie/token | `401 REFRESH_TOKEN_MISSING` |
| `POST /api/v1/auth/refresh` with invalid body token | `401 REFRESH_TOKEN_INVALID` |
| `POST /api/v1/auth/logout` | `204 No Content` |
| `GET /api/v1/auth/me` with bearer token | `200 OK` |
| `GET http://localhost:5001/health` | `200`, service `auth-service` |

Register, login, logout, refresh, and current-user endpoints were all exercised through the gateway.

### 2.5 Additional environment fixes required for local execution

These are local environment issues, not repository defects:

- **PostgreSQL port conflict:** an unrelated `catalyst_postgres` already owned 5432. The intended `talent-ai-postgres` container was started on **5433**, and the local `.env` database URLs were pointed at 5433.
- **MongoDB port conflict:** a native standalone `mongod` already owned 27017. The Docker MongoDB replica set was published on **27018**, and the local `.env` Mongo URIs were pointed at 27018.
  - The native standalone MongoDB caused the talent service's transactional outbox to fail with:
    `Transaction numbers are only allowed on a replica set member or mongos`
  - After remapping to the Docker replica set (`rs0`, primary), profile creation succeeded.
- These local overrides are in `.env` only. `.env.example` keeps the standard 5432/27017 defaults.

### 2.6 Onboarding defect found during live browser execution

**Status:** Fixed and verified.

#### Symptom

On the education step, clicking **Next step** advanced to the experience step and also submitted the profile. The saved profile contained education but `previousExperience: []`, even though the experience step had not been completed.

#### Root cause

The same DOM button was reused across steps:

- On earlier steps it rendered as `type="button"` with an `onClick` that advances the step.
- On the final step it rendered as `type="submit"`.

During the click that advanced from education to experience, React updated the button to `type="submit"`. The browser then performed the native form-submit default action for that same click, and `handleSubmit` saw `step === LAST_STEP`, so it persisted the profile immediately.

#### Fix

`apps/candidate-portal/src/components/Onboarding.tsx`:

- Extracted the persistence logic into `submitProfile()`.
- Kept `handleSubmit()` only for native form submission (e.g. pressing Enter), with the existing step guard.
- Changed the final **Submit profile** button to `type="button"` with `onClick={() => void submitProfile()}`.

This makes it impossible for a step-navigation button to become a native submit button during the same click.

#### Verification

- Typecheck: `pnpm --filter @talent-ai/candidate-portal typecheck` → passed.
- Focused reproduction after the fix:
  - `profileCreatedVisible: false`
  - `experienceStepVisible: true`
- Full UI onboarding then saved the experience:
  - API `GET /api/v1/talent/me` for the UI-created candidate returned `experienceCount: 1`, company `UI Cloud Labs`, role `Frontend Engineer`.
- Screenshots:
  - `docs/phase-10.1-artifacts/05-onboarding-experience.png`
  - `docs/phase-10.1-artifacts/06-profile-created.png`
  - `docs/phase-10.1-artifacts/repro-after-education-next.png`

## 3. Part B — Startup verification

| Component | Port | Verification | Result |
| --- | ---: | --- | --- |
| API Gateway | 8080 | `GET /health/liveness` | `200`, `api-gateway` |
| API Gateway readiness | 8080 | `GET /health/readiness` | `200`, `status: ok`, `redis: up` |
| Auth Service | 5001 | `GET /health` | `200`, `auth-service` |
| Talent Service | 5002 | `GET /health` | `200`, `talent-service` |
| AI Matching Service | 5006 | `GET /health` | `200`, `ai-matching-service` |
| Candidate Portal | 3000 | `GET /` and `/src/index.css` | `200` |
| Recruiter Portal | 3001 | `GET /` and `/src/index.css` | `200` |
| PostgreSQL | 5433 | `pg_isready` | accepting connections |
| MongoDB | 27018 | `db.hello()` | `setName: rs0`, primary |
| Redis | 6379 | `PING` | `PONG` |
| RabbitMQ | 5672 / 15672 | management API | `200` |
| Qdrant | 6333 | `/healthz` | `200` |

Gateway readiness circuits at the end of execution:

- `auth-service`: `CLOSED`
- `ai-matching-service`: `CLOSED`
- `talent-service`: `CLOSED`
- `recruiter-service`: `CLOSED`
- `engagement-service`: `OPEN` (service not started)
- `notification-service`: `OPEN` (service not started)
- `rewards-service`: `CLOSED`
- `analytics-service`: `CLOSED`

The candidate journey does not require engagement or notification services; the dashboard degrades gracefully when their calls fail. See limitations.

## 4. Part C — Issue #19 checklist results

| # | Checklist item | Result | Evidence |
| ---: | --- | --- | --- |
| 1 | Register a new candidate | **PASS** | `POST /api/v1/auth/register` → `201` |
| 2 | Verify access token and refresh cookie/session issuance | **PASS** | JWT claims + `Set-Cookie` + refresh `200`; missing/invalid refresh `401` |
| 3 | Create the candidate talent profile | **PASS** | `POST /api/v1/talent/` → `201` |
| 4 | Populate skills, experience, education and profile links | **PASS** | Response contains 8 skills, 2 experience entries, 1 education entry, 4 links |
| 5 | Fetch profile using `GET /api/v1/talent/me` | **PASS** | `200`, persisted profile returned |
| 6 | Update profile and verify persistence | **PASS** | `PUT /api/v1/talent/:id` → `200`; subsequent `GET /me` → `200` with updated values |
| 7 | Execute AI profile summary | **PASS** | `POST /api/v1/ai/summarize-profile` → `200`, 5 summary lines |
| 8 | Execute AI improvement suggestions | **PASS** | `POST /api/v1/ai/suggest-improvements` → `200`, 2 suggestions |
| 9 | Verify deterministic fallback when no external AI provider is configured | **PASS** | `AI_PROVIDER=auto` with no keys resolves to `local`; deterministic non-empty output |
| 10 | Playwright: sign-in, onboarding, profile save, dashboard rendering | **PASS** | Screenshots 01–08; UI profile persisted with experience; reload persistence verified |
| 11 | Protected endpoints reject missing and invalid tokens | **PASS** | Talent and AI endpoints → `401 AUTH_TOKEN_MISSING` / `401 AUTH_TOKEN_INVALID` |
| 12 | Candidate users cannot access recruiter-only operations | **PASS** | `GET /api/v1/talent/` → `403`; `POST /api/v1/ai/talent-lens` → `403` |
| 13 | Invalid payload handling and unknown routes | **PASS** | Validation `400`, malformed JSON `400`, unknown routes `404` |
| 14 | API Gateway health and readiness | **PASS** | `/health/liveness` `200`; `/health/readiness` `200`, Redis up |

### 4.1 Step 1–2 — registration, token, refresh cookie

Request (sanitized):

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "candidate.phase101.<timestamp>@example.com",
  "password": "<redacted>",
  "fullName": "Phase 10.1 Candidate",
  "role": "CANDIDATE"
}
```

Response: `201 Created`

```json
{
  "user": {
    "id": "e7ba2a2e-dc77-4c64-9fc4-b2b761ca2152",
    "email": "candidate.phase101.<timestamp>@example.com",
    "fullName": "Phase 10.1 Candidate",
    "role": "CANDIDATE"
  },
  "permissions": ["talent:read", "talent:write"],
  "tokens": {
    "accessToken": "<redacted>",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

Refresh cookie header (sanitized):

```http
Set-Cookie: talent_ai_refresh=<redacted>; Max-Age=604800; Path=/api/v1/auth; HttpOnly; SameSite=Lax
```

Access-token claims:

```json
{
  "sub": "e7ba2a2e-dc77-4c64-9fc4-b2b761ca2152",
  "role": "CANDIDATE",
  "type": "access",
  "iss": "talent.ai",
  "aud": "talent.ai",
  "expInSeconds": 900,
  "sessionIdPresent": true
}
```

Refresh verification:

| Request | Status |
| --- | ---: |
| `POST /api/v1/auth/refresh` with cookie | `200` |
| `POST /api/v1/auth/refresh` with no cookie/token | `401 REFRESH_TOKEN_MISSING` |
| `POST /api/v1/auth/refresh` with invalid body token | `401 REFRESH_TOKEN_INVALID` |
| `POST /api/v1/auth/logout` | `204` |
| `POST /api/v1/auth/refresh` after logout with cleared cookie | `401 REFRESH_TOKEN_MISSING` |

### 4.2 Step 3–4 — profile creation with full data

Request (abbreviated, sanitized):

```http
POST /api/v1/talent/
Authorization: Bearer <redacted>
Content-Type: application/json

{
  "name": "Phase 10.1 Candidate",
  "email": "candidate.phase101.<timestamp>@example.com",
  "phone": "+1 415 555 0199",
  "field": "Full Stack Engineering",
  "skills": ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "GraphQL", "Testing"],
  "experienceYears": 6,
  "education": [
    {
      "college": "State University",
      "degree": "B.Tech",
      "branchOfStudy": "Computer Science",
      "yearOfGraduation": 2019,
      "gpa": 8.6
    }
  ],
  "previousExperience": [
    {
      "company": "Acme Cloud",
      "role": "Senior Software Engineer",
      "durationMonths": 36,
      "responsibilities": ["Led migration to AWS", "Cut API latency by 40%"],
      "startDate": "2022-01-01",
      "endDate": "2025-01-01"
    }
  ],
  "bio": "Full stack engineer focused on reliable TypeScript services, cloud infrastructure and measurable product outcomes.",
  "portfolioUrl": "https://portfolio.example.com/phase-101",
  "linkedinUrl": "https://www.linkedin.com/in/phase-101-candidate",
  "githubUrl": "https://github.com/phase-101-candidate",
  "resumeUrl": "https://portfolio.example.com/phase-101/resume.pdf"
}
```

Response: `201 Created`

```json
{
  "data": {
    "id": "6aef1b07260654292200fcb3",
    "userId": "e7ba2a2e-dc77-4c64-9fc4-b2b761ca2152",
    "name": "Phase 10.1 Candidate",
    "field": "Full Stack Engineering",
    "skills": ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "GraphQL", "Testing"],
    "experienceYears": 6,
    "level": "LEVEL_2_MID",
    "educationCount": 1,
    "experienceCount": 2,
    "links": {
      "portfolioUrl": "https://portfolio.example.com/phase-101",
      "linkedinUrl": "https://www.linkedin.com/in/phase-101-candidate",
      "githubUrl": "https://github.com/phase-101-candidate",
      "resumeUrl": "https://portfolio.example.com/phase-101/resume.pdf"
    }
  }
}
```

### 4.3 Step 5–6 — fetch, update, persistence

| Request | Status | Result |
| --- | ---: | --- |
| `GET /api/v1/talent/me` | `200` | Returned the created profile, skills, bio and links |
| `PUT /api/v1/talent/6aef1b07260654292200fcb3` | `200` | Updated field, experience years, skills, bio and LinkedIn URL |
| `GET /api/v1/talent/me` after update | `200` | Persisted values returned |

Update request (abbreviated):

```json
{
  "field": "Staff Platform Engineering",
  "experienceYears": 7,
  "skills": ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "GraphQL", "Testing", "Kubernetes"],
  "bio": "Staff platform engineer building reliable TypeScript services, Kubernetes platforms and measurable product outcomes.",
  "linkedinUrl": "https://www.linkedin.com/in/phase-101-candidate-updated"
}
```

Persistence verification returned:

```json
{
  "data": {
    "id": "6aef1b07260654292200fcb3",
    "field": "Staff Platform Engineering",
    "experienceYears": 7,
    "skillCount": 9,
    "linkedinUrl": "https://www.linkedin.com/in/phase-101-candidate-updated"
  }
}
```

### 4.4 Step 7–9 — AI summary, suggestions, deterministic local path

The AI service was configured with `AI_PROVIDER=auto` and empty `GROQ_API_KEY`, `GEMINI_API_KEY`, and `OPENAI_API_KEY`. It resolved to the local deterministic engine. The requests used the same inline-profile shape the candidate dashboard sends.

Summary request:

```http
POST /api/v1/ai/summarize-profile
Authorization: Bearer <redacted>
Content-Type: application/json

{
  "talentId": "6aef1b07260654292200fcb3",
  "profile": {
    "name": "Phase 10.1 Candidate",
    "field": "Staff Platform Engineering",
    "skills": ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "GraphQL", "Testing", "Kubernetes"],
    "experienceYears": 7,
    "level": "LEVEL_2_MID",
    "education": [],
    "previousExperience": [],
    "bio": "Staff platform engineer building reliable TypeScript services..."
  }
}
```

Response: `200 OK`

```json
{
  "data": {
    "provider": "local",
    "fallback": false,
    "cached": false,
    "summary": [
      "Phase 10.1 Candidate is a Pro Engineer Staff Platform Engineering professional with 7 years of experience.",
      "Core skills include TypeScript, React, Node.js, PostgreSQL, AWS, Docker.",
      "Education: B.Tech in Computer Science from State University.",
      "Recent role: Senior Software Engineer at Acme Cloud (36 months).",
      "Staff platform engineer building reliable TypeScript services, Kubernetes platforms and measurable product outcomes."
    ]
  }
}
```

Suggestions response: `200 OK`

```json
{
  "data": {
    "provider": "local",
    "fallback": false,
    "cached": false,
    "suggestions": [
      "Rewrite experience bullets to quantify impact (latency, revenue, users or cost) instead of listing duties.",
      "Target Pro Engineer roles in Staff Platform Engineering and mirror their vocabulary in your profile."
    ]
  }
}
```

**Note on `fallback: false`:** with no external provider keys, `AI_PROVIDER=auto` resolves to the `local` provider, so the deterministic engine is the configured provider rather than an error fallback. The output is deterministic, non-empty, and produced without any external AI call. This satisfies the fallback/deterministic requirement.

### 4.5 Step 11 — protected endpoints

| Request | Status | Error code |
| --- | ---: | --- |
| `GET /api/v1/talent/me` with no token | `401` | `AUTH_TOKEN_MISSING` |
| `GET /api/v1/talent/me` with invalid bearer | `401` | `AUTH_TOKEN_INVALID` |
| `POST /api/v1/ai/summarize-profile` with no token | `401` | `AUTH_TOKEN_MISSING` |
| `POST /api/v1/ai/summarize-profile` with invalid bearer | `401` | `AUTH_TOKEN_INVALID` |

### 4.6 Step 12 — candidate RBAC

| Request | Status | Error code |
| --- | ---: | --- |
| `GET /api/v1/talent/` as candidate | `403` | `FORBIDDEN` |
| `POST /api/v1/ai/talent-lens` as candidate | `403` | `FORBIDDEN` |

Both are recruiter/admin-only operations and were rejected for the candidate token. The recruiter service itself was not started; equivalent recruiter-only routes in the talent and AI services were used.

### 4.7 Step 13 — invalid payloads and unknown routes

| Request | Status | Error code |
| --- | ---: | --- |
| `POST /api/v1/auth/register` with invalid email/password/name | `400` | `VALIDATION_ERROR` |
| `POST /api/v1/auth/login` with invalid email/empty password | `400` | `VALIDATION_ERROR` |
| `POST /api/v1/talent/` with invalid profile fields | `400` | `VALIDATION_ERROR` |
| `POST /api/v1/auth/register` with malformed JSON | `400` | `INVALID_JSON` |
| `GET /api/v1/does-not-exist` | `404` | `NOT_FOUND` |
| `GET /api/v1/talent/unknown/path` | `404` | `NOT_FOUND` |
| `POST /api/v1/auth/refresh` with invalid refresh token | `401` | `REFRESH_TOKEN_INVALID` |

Example validation response:

```json
{
  "status": 400,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "formErrors": [],
      "fieldErrors": {
        "email": ["A valid email is required"],
        "password": ["Password must be at least 12 characters", "Password must contain a number"],
        "fullName": ["Full name is required"]
      }
    }
  }
}
```

### 4.8 Step 14 — gateway health and readiness

`GET http://localhost:8080/health/liveness` → `200`

```json
{
  "status": "ok",
  "service": "api-gateway",
  "version": "0.1.0",
  "uptimeSeconds": 42,
  "timestamp": "2026-11-07T12:33:48.435Z"
}
```

`GET http://localhost:8080/health/readiness` → `200`

```json
{
  "status": "ok",
  "checks": { "redis": "up" },
  "circuits": [
    { "name": "auth-service", "state": "CLOSED", "consecutiveFailures": 0 },
    { "name": "ai-matching-service", "state": "CLOSED", "consecutiveFailures": 0 },
    { "name": "talent-service", "state": "CLOSED", "consecutiveFailures": 0 },
    { "name": "recruiter-service", "state": "CLOSED", "consecutiveFailures": 0 },
    { "name": "engagement-service", "state": "OPEN", "consecutiveFailures": 6 },
    { "name": "notification-service", "state": "OPEN", "consecutiveFailures": 6 }
  ]
}
```

The readiness endpoint itself is healthy. The open engagement/notification circuits are due to those optional services not running; see limitations.

## 5. Playwright browser verification (Step 10)

Playwright 1.55.0 was used with the system Google Chrome binary. The driver script was stored outside the repository; no test spec or fixture was added.

### Verified flow

1. Open `http://localhost:3000` — landing page renders.
2. Sign in as the API-created candidate — redirected to `/dashboard`.
3. Dashboard shows:
   - candidate name
   - field and experience
   - skills
   - education
   - experience
   - AI profile summary
   - improvement suggestions
4. Sign out.
5. Register a fresh candidate through the UI.
6. Complete onboarding:
   - personal details and skills
   - education
   - experience
7. Submit profile — "Profile created" confirmation.
8. Open dashboard — new candidate profile and AI summary render.
9. Reload dashboard — profile still renders (persistence).

The combined automated run exhausted the auth service's 5-requests/minute sensitive rate limit on the reload step (`429`). After waiting for the window to reset, a focused sign-in + reload check was executed and passed; screenshot `08-dashboard-after-reload.png` is from that focused check. The initial dashboard render, including suggestions, is captured in `07-dashboard-new-candidate.png`.

### Browser result summary

```json
{
  "signIn": {
    "url": "http://localhost:3000/dashboard",
    "headingPresent": true
  },
  "dashboard": {
    "fieldPresent": true,
    "skillsPresent": true,
    "educationPresent": true,
    "experiencePresent": true,
    "aiSummaryPresent": true,
    "suggestionsPresent": true
  },
  "persistenceAfterReload": {
    "url": "http://localhost:3000/dashboard",
    "headingPresent": true,
    "experiencePresent": true
  }
}
```

UI-created profile confirmed through the API:

```json
{
  "data": {
    "id": "6aef1c6c260654292200fe36",
    "name": "UI Journey Candidate",
    "field": "Frontend Platform Engineering",
    "skills": ["TypeScript", "React", "Node.js", "AWS", "Testing"],
    "experienceYears": 5,
    "educationCount": 1,
    "experienceCount": 1,
    "experience": [
      {
        "company": "UI Cloud Labs",
        "role": "Frontend Engineer",
        "durationMonths": 12,
        "responsibilities": [
          "Built accessible React applications",
          "Improved Core Web Vitals by 35%"
        ]
      }
    ]
  }
}
```

### Screenshots

| File | Description |
| --- | --- |
| `docs/phase-10.1-artifacts/01-landing.png` | Candidate landing page |
| `docs/phase-10.1-artifacts/02-dashboard-existing-candidate.png` | Signed-in dashboard for the API-created candidate |
| `docs/phase-10.1-artifacts/03-onboarding-personal.png` | Onboarding — personal details and skills |
| `docs/phase-10.1-artifacts/04-onboarding-education.png` | Onboarding — education |
| `docs/phase-10.1-artifacts/05-onboarding-experience.png` | Onboarding — experience (after fix) |
| `docs/phase-10.1-artifacts/06-profile-created.png` | Profile-created confirmation |
| `docs/phase-10.1-artifacts/07-dashboard-new-candidate.png` | Dashboard for the UI-created candidate |
| `docs/phase-10.1-artifacts/08-dashboard-after-reload.png` | Dashboard after reload (persistence) |
| `docs/phase-10.1-artifacts/repro-after-education-next.png` | Focused check: education **Next step** now advances to experience |
| `docs/phase-10.1-artifacts/repro-result.txt` | Focused check result JSON |

### Browser console notes

The browser recorded 15 console errors, all expected in this partial stack:

- `401` — refresh/bootstrap without a session during signed-out states.
- `429` — auth/AI sensitive rate limit during rapid automated runs.
- `502`/`503` — engagement and notification services not running.
- WebSocket `ERR_CONNECTION_REFUSED` — notification service not running; the portal has no local `.env` overriding the default `ws://localhost:5007/ws/notifications`.

No Tailwind resolution errors and no `ApiClientError` export errors were observed.

## 6. Defects found and fixes applied

| # | Defect | Root cause | Fix | Status |
| ---: | --- | --- | --- | --- |
| 1 | Auth refresh 404 | Global `PORT=5001` in root `.env`; AI service occupied 5001; auth service never bound | Replaced with `AUTH_SERVICE_PORT=5001` in `.env` and `.env.example`; restarted stack | Fixed |
| 2 | Onboarding premature profile save | Step button changed from `type="button"` to `type="submit"` during the same click | Extracted `submitProfile()`; final button is now `type="button"` with `onClick` | Fixed |
| 3 | Talent profile create 500 (`Transaction numbers...`) | Native standalone `mongod` on 27017 intercepted `localhost`; talent service connected to it instead of Docker replica set | Remapped Docker MongoDB to 27018; updated local `.env`; verified `rs0` primary | Environment fixed |
| 4 | Auth service could not start | Prisma Client not generated | Ran `db:generate`; ran `db:deploy` | Fixed |
| 5 | PostgreSQL unavailable on 5432 | Unrelated `catalyst_postgres` owned 5432 | Started talent Postgres on 5433; updated local `.env` | Environment fixed |
| 6 | Stale `ApiClientError` export | Stale `packages/api-client/dist` | Rebuilt `@talent-ai/api-client`; verified runtime export | Verified |
| 7 | Tailwind Vite resolution | Missing/stale workspace symlinks | Verified both workspaces resolve after workspace install; CSS transforms `200` | Verified |
| 8 | Gateway unreachable | Process not running | Restarted gateway; liveness/readiness `200` | Verified |

## 7. Remaining blockers and limitations

1. **Engagement and notification services are not running.**
   - Dashboard calls to `/api/v1/engagement/...` and `/api/v1/notifications/unread-count` return `502`/`503`.
   - Their gateway circuit breakers are `OPEN`.
   - The candidate dashboard still renders profile, education, experience, and AI summary because those calls are best-effort.
   - If recruiter feedback, engagement signal, or realtime notifications are required, start those services and their datastores.

2. **Notification WebSocket defaults to port 5007.**
   - The candidate portal has no local `.env`, so `@talent-ai/api-client` uses `ws://localhost:5007/ws/notifications`.
   - `.env.example` recommends `ws://localhost:8080/ws/notifications`.
   - This only affects realtime notifications, not the candidate journey.

3. **Auth sensitive rate limit is 5 requests/minute.**
   - Rapid automated sign-in/refresh/reload cycles hit `429`.
   - This is expected behavior, not a functional failure, but it is low for a page that calls `/auth/me` during bootstrap.
   - The focused reload persistence check passed after the window reset.

4. **Recruiter service was not started.**
   - Candidate RBAC was verified against recruiter-only routes in the talent and AI services (`403 FORBIDDEN`).
   - If the recruiter portal's own endpoints need live verification, start `recruiter-service` and its database.

5. **Local port overrides differ from `.env.example`.**
   - Local `.env` uses PostgreSQL `5433` and MongoDB `27018` because of host conflicts.
   - `.env.example` retains the standard `5432`/`27017` defaults.

6. **GitHub CLI is not installed.**
   - The execution results were not posted as an Issue #19 comment.
   - See the posting instructions below.

## 8. Files changed

| File | Change |
| --- | --- |
| `.env.example` | Replaced global `PORT=5001` with `AUTH_SERVICE_PORT=5001` and documented the reason. |
| `.env` (local, gitignored) | Same port fix; local PostgreSQL URLs moved to 5433; local MongoDB URIs moved to 27018. |
| `apps/candidate-portal/src/components/Onboarding.tsx` | Extracted `submitProfile()`; final button is now `type="button"` to prevent premature native form submission. |
| `docs/phase-10.1-candidate-journey-execution.md` | This report. |
| `docs/phase-10.1-artifacts/` | Live browser screenshots and focused-check result. |

No changes were made to `packages/api-client` source; its `dist` was rebuilt. No commit or push was performed.

## 9. Verification commands

Local stack startup used for this execution (local port overrides only):

```bash
# Start the intended PostgreSQL and MongoDB containers on conflict-free host ports.
POSTGRES_PORT=5433 docker compose -f infrastructure/docker/docker-compose.infra.yml up -d postgres
MONGODB_PORT=27018 docker compose -f infrastructure/docker/docker-compose.infra.yml up -d mongodb

# Prepare the auth database.
pnpm --filter @talent-ai/auth-service db:generate
pnpm --filter @talent-ai/auth-service db:deploy

# Start services and the candidate portal (each in its own terminal).
pnpm --filter @talent-ai/auth-service dev
pnpm --filter @talent-ai/talent-service dev
pnpm --filter @talent-ai/ai-matching-service dev
pnpm --filter @talent-ai/api-gateway dev
pnpm --filter @talent-ai/candidate-portal dev
```

Verification commands:

```bash
# Health checks
curl -sS http://localhost:8080/health/liveness
curl -sS http://localhost:8080/health/readiness
curl -sS http://localhost:5001/health
curl -sS http://localhost:5002/health
curl -sS http://localhost:5006/health

# Auth flow
curl -i -X POST http://localhost:8080/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"candidate.<ts>@example.com","password":"<redacted>","fullName":"Phase 10.1 Candidate","role":"CANDIDATE"}'

curl -i -b cookies.txt -c cookies.txt \
  -X POST http://localhost:8080/api/v1/auth/refresh \
  -H 'Content-Type: application/json' -d '{}'

# Talent profile
curl -i -X POST http://localhost:8080/api/v1/talent/ \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' --data @profile.json

curl -i http://localhost:8080/api/v1/talent/me \
  -H "Authorization: Bearer $TOKEN"

# AI
curl -i -X POST http://localhost:8080/api/v1/ai/summarize-profile \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' --data @ai-profile.json

curl -i -X POST http://localhost:8080/api/v1/ai/suggest-improvements \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' --data @ai-profile.json

# Build / typecheck
pnpm --filter @talent-ai/api-client build
pnpm --filter @talent-ai/candidate-portal typecheck

# Prisma
pnpm --filter @talent-ai/auth-service db:generate
pnpm --filter @talent-ai/auth-service db:deploy

# Workspace dependency resolution
(cd apps/candidate-portal && node -e "console.log(require.resolve('@tailwindcss/vite'))")
(cd apps/recruiter-portal && node -e "console.log(require.resolve('@tailwindcss/vite'))")

# CSS transform
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/src/index.css
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3001/src/index.css
```

## 10. Posting to Issue #19

`gh` is not installed in this environment, so the report was not posted automatically. After installing and authenticating GitHub CLI, run:

```bash
gh issue comment 19 --repo VijeshVS/talent.ai \
  --body-file docs/phase-10.1-candidate-journey-execution.md
```

Alternatively, open the issue in the GitHub web UI and paste the report body as a comment.

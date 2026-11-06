# @talent-ai/api-client

Shared Axios client for `apps/candidate-portal` and `apps/recruiter-portal`.

## What it does

- Centralizes the gateway base URL (`VITE_API_GATEWAY_URL`) — no hard-coded localhost URLs.
- Attaches the JWT access token (`Authorization: Bearer <token>`) via a request interceptor.
- On `401`, refreshes the session once via `POST /api/v1/auth/refresh` (cookie-aware, `withCredentials: true`).
  Concurrent 401s share a single refresh promise — no refresh storms.
- On refresh failure, clears the stored tokens and redirects to the login page (configurable).

## Option A — default singleton (recommended)

```ts
import { apiClient } from '@talent-ai/api-client';
```

The singleton reads `VITE_API_GATEWAY_URL` from `import.meta.env` automatically.
Set it in each app's `.env` / `.env.example`.

## Option B — explicit per-app instance

```ts
import { createApiClient } from '@talent-ai/api-client';
import { appConfig } from '../config';

export const apiClient = createApiClient({
  baseURL: appConfig.apiGatewayUrl, // sourced from VITE_API_GATEWAY_URL
  loginPath: '/', // both portals render login at "/"
});
```

Usage in components:

```ts
import { apiClient } from '../lib/api';

const { data } = await apiClient.get('/api/v1/talent/me');
await apiClient.post('/api/v1/talent', payload);
```

## Tokens

```ts
import { setAccessToken, clearTokens, tokenStore } from '@talent-ai/api-client';

// After POST /api/v1/auth/login
setAccessToken(response.data.tokens.accessToken);

// On logout / session expiry
clearTokens();
```

The access token is persisted in `localStorage`. The refresh token travels as an `HttpOnly`
cookie (`withCredentials`), so JavaScript does not need to store it — it is kept in memory
only when the server also returns it in the JSON body.

## Redirect behaviour

By default a failed refresh clears tokens and navigates to `loginPath` (`/login`).
Pass `onSessionExpired` to plug into React Router instead:

```ts
createApiClient({ onSessionExpired: () => navigate('/') });
```

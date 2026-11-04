# @talent-ai/observability

Shared OpenTelemetry tracing, Prometheus metrics and secret loading for talent.ai
services.

## Tracing

Import the tracing entry point **before** Express, Prisma, ioredis or amqplib so
the OpenTelemetry instrumentations can patch those modules:

```ts
// src/tracing.ts
import { startTracing } from '@talent-ai/observability/tracing';
import { config } from './config.js';

export const tracing = startTracing({
  serviceName: config.serviceName,
  serviceVersion: config.version,
  environment: config.nodeEnv,
  endpoint: config.otel.endpoint, // base URL, e.g. http://jaeger:4318
  enabled: config.otel.enabled,
});
```

```ts
// src/server.ts
import './tracing.js'; // must be the first import
```

- OTLP/HTTP export to `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` (or
  `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` when set).
- `OTEL_ENABLED=false` or `NODE_ENV=test` disables tracing.
- Health and metric paths are excluded from incoming HTTP spans.
- HTTP, Express, ioredis, amqplib and Postgres are instrumented.
- Call `shutdownTracing()` during graceful shutdown to flush pending spans.

## Metrics

```ts
import { createHttpMetrics } from '@talent-ai/observability/metrics';

const metrics = createHttpMetrics(config.serviceName);

app.get('/metrics', metrics.handler);
app.use(metrics.middleware);
```

Exports `http_requests_total`, `http_request_duration_seconds`,
`http_requests_in_flight` plus the `talent_`-prefixed Node/process defaults.

## Secrets

```ts
import { loadSecret, requireSecret } from '@talent-ai/observability/secrets';

const value = loadSecret('JWT_ACCESS_SECRET'); // reads JWT_ACCESS_SECRET_FILE first
```

`<NAME>_FILE` supports Docker secrets and Kubernetes `secretKeyRef` volume
mounts without committing values.

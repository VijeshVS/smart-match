# Kubernetes manifests

Phase 9.5 deployment assets for talent.ai.

| File | Contents |
| :--- | :--- |
| `namespace.yaml` | `talent-ai` namespace. |
| `configmap.yaml` | Shared non-secret configuration (telemetry, URLs, rate limits, cookie policy). |
| `secret.example.yaml` | Template for `talent-ai-secrets`. Never commit real values. |
| `auth-service.yaml` | `auth-service` Deployment + ClusterIP Service. |
| `talent-service.yaml` | `talent-service` Deployment + ClusterIP Service (port 5002, MongoDB). |
| `recruiter-service.yaml` | `recruiter-service` Deployment + ClusterIP Service (port 5003, PostgreSQL). |
| `engagement-service.yaml` | `engagement-service` Deployment + ClusterIP Service (port 5004, PostgreSQL). |
| `rewards-service.yaml` | `rewards-service` Deployment + ClusterIP Service (port 5005, PostgreSQL). |
| `ai-matching-service.yaml` | `ai-matching-service` Deployment + ClusterIP Service (port 5006, Qdrant + Redis). |
| `notification-service.yaml` | `notification-service` Deployment + sticky ClusterIP Service (port 5007, MongoDB + Redis fan-out, WebSocket). |
| `analytics-service.yaml` | `analytics-service` Deployment + ClusterIP Service (port 5008, PostgreSQL read models). |
| `api-gateway.yaml` | `api-gateway` Deployment + ClusterIP Service. |
| `hpa.yaml` | CPU/memory HPAs for every service. |
| `ingress.yaml` | Nginx ingress for `api.talent.ai`, `talent.ai`, `recruiter.talent.ai`. |
| `observability/prometheus.yaml` | Prometheus ConfigMap (scrape config), Deployment and Service. |
| `observability/grafana.yaml` | Grafana datasources/provider ConfigMaps, Deployment (with the generated dashboards ConfigMap) and Service. |
| `secret.grafana.example.yaml` | Template for the optional `talent-ai-grafana-admin` secret. |
| `kustomization.yaml` | Renders the application manifests above. |
| `../kustomization.yaml` | Renders the application **plus** observability and generates the dashboard/rule ConfigMaps from the Compose files. |

## Render and apply

Use the parent kustomization to deploy the application and observability
together:

```bash
kubectl kustomize infrastructure            # preview
kubectl apply -k infrastructure

# application manifests only
kubectl kustomize infrastructure/k8s
kubectl apply -k infrastructure/k8s
```

`infrastructure/kustomization.yaml` generates
`talent-ai-grafana-dashboards` and `talent-ai-prometheus-rules` directly from
`infrastructure/docker/grafana/dashboards/` and
`infrastructure/docker/prometheus/rules/`. Do not copy dashboards into
`infrastructure/k8s/`.

Create the Grafana admin secret before exposing Grafana:

```bash
kubectl apply -f infrastructure/k8s/secret.grafana.example.yaml   # edit first
```

Secrets are created out of band:
kubectl -n talent-ai create secret generic talent-ai-secrets \
  --from-literal=DATABASE_URL='postgresql://talent:...@postgres:5432/talent_auth' \
  --from-literal=RECRUITER_DATABASE_URL='postgresql://talent:...@postgres:5432/talent_recruiter?schema=public' \
  --from-literal=ENGAGEMENT_DATABASE_URL='postgresql://talent:...@postgres:5432/talent_engagement?schema=public' \
  --from-literal=REWARDS_DATABASE_URL='postgresql://talent:...@postgres:5432/talent_rewards?schema=public' \
  --from-literal=ANALYTICS_DATABASE_URL='postgresql://talent:...@postgres:5432/talent_analytics?schema=public' \
  --from-literal=ANALYTICS_DB_USER='talent' \
  --from-literal=ANALYTICS_DB_PASSWORD='...' \
  --from-literal=MONGODB_URI='mongodb://talent:...@mongodb:27017/talent_profiles?replicaSet=rs0' \
  --from-literal=NOTIFICATION_MONGODB_URI='mongodb://talent:...@mongodb:27017/talent_notif?replicaSet=rs0' \
  --from-literal=REDIS_URL='redis://redis:6379' \
  --from-literal=RABBITMQ_URL='amqp://talent:...@rabbitmq:5672' \
  --from-literal=JWT_ACCESS_SECRET='...' \
  --from-literal=JWT_REFRESH_SECRET='...' \
  --from-literal=GROQ_API_KEY='...' \
  --from-literal=GEMINI_API_KEY='...' \
  --from-literal=OPENAI_API_KEY='...' \
  --from-literal=QDRANT_API_KEY='...'
```

The AI provider and Qdrant credentials are optional. With `AI_PROVIDER=auto` and
no provider keys, `ai-matching-service` uses its deterministic local engine;
`QDRANT_API_KEY` is only required when Qdrant has authentication enabled.
`SMTP_URL` is optional: without it, notification email is rendered to the log
rather than sent. Notification pods share live sockets through Redis pub/sub, so
scaling past one replica does not strand a connected client.

Analytics migrations are applied out of band, once per release:

```bash
pnpm --filter @talent-ai/analytics-service db:deploy
```

Prerequisites:

- An Nginx ingress controller and a `talent-ai-tls` certificate secret.
- PostgreSQL, Redis, RabbitMQ, MongoDB and Qdrant reachable at the hosts
  referenced in the secret / ConfigMap (in-cluster or managed services).
- An OTLP endpoint at `jaeger-collector.observability.svc.cluster.local:4318`
  or an override of `OTEL_EXPORTER_OTLP_ENDPOINT` in the ConfigMap.
- Metrics scraping: the bundled Prometheus deployment scrapes the service
  ClusterIPs and the RabbitMQ/Qdrant/exporter endpoints in
  `observability/prometheus.yaml`. Replace those targets when the dependencies
  are managed outside the cluster.
- Grafana reads the analytics datasource from `ANALYTICS_DB_*` env vars backed
  by `talent-ai-secrets`; see `observability/grafana.yaml`.

## Adding a service

Each new microservice (AI matching, notification, analytics) follows
the same pattern as `auth-service.yaml` / `recruiter-service.yaml`:

1. Copy the Deployment/Service pair and replace every `auth-service` /
   `5001` occurrence with the new service name and `SERVICE_PORTS` value.
2. Add the file to `resources` in `kustomization.yaml` and add its image to the
   `images` list.
3. Add an HPA entry to `hpa.yaml`.
4. Add the image to the CI matrix in `.github/workflows/docker.yml`.

Portal Services (`candidate-portal`, `recruiter-portal`) are created in Phase 8
and are already referenced by the ingress rules.

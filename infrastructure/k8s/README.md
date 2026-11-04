# Kubernetes manifests

Phase 9.5 adds:

- `Deployment`, `Service` and `ConfigMap` manifests for the gateway and all eight domain services.
- `Secret` templates (never commit real values).
- Ingress routing for `talent.ai`, `recruiter.talent.ai` and `api.talent.ai`.
- Horizontal Pod Autoscaler policies driven by CPU and memory.

Nothing is deployed from this directory yet.

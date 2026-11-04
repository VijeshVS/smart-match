import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import type { IncomingMessage } from 'node:http';

export interface TracingOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  /** Explicit OTLP/HTTP traces endpoint, e.g. `http://jaeger:4318/v1/traces`. */
  endpoint?: string;
  /** Sampling can be tuned through `OTEL_TRACES_SAMPLER*` environment variables. */
  enabled?: boolean;
}

export interface ObservabilityHandle {
  enabled: boolean;
  shutdown(): Promise<void>;
}

const HEALTH_PATHS = new Set(['/health', '/health/liveness', '/health/readiness', '/metrics']);

function resolveTracesEndpoint(explicit?: string): string | undefined {
  const direct = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  if (direct) return direct;

  // Both the config value and `OTEL_EXPORTER_OTLP_ENDPOINT` are base URLs;
  // tolerate a full `/v1/traces` URL as well.
  const base = explicit ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!base) return undefined;

  const normalized = base.replace(/\/+$/, '');
  return normalized.endsWith('/v1/traces') ? normalized : `${normalized}/v1/traces`;
}

function shouldIgnoreIncoming(request: IncomingMessage): boolean {
  const url = request.url ?? '';
  const path = url.split('?')[0] ?? '';
  return HEALTH_PATHS.has(path);
}

let activeSdk: NodeSDK | undefined;

/**
 * Boots the OpenTelemetry NodeSDK for a service.
 *
 * Must be imported before Express, Prisma, ioredis or amqplib so their
 * instrumentations can patch the modules on load.
 */
export function startTracing(options: TracingOptions): ObservabilityHandle {
  const enabled =
    options.enabled ?? (process.env.OTEL_ENABLED !== 'false' && process.env.NODE_ENV !== 'test');

  if (!enabled || activeSdk) {
    return {
      enabled: Boolean(activeSdk),
      shutdown: async () => {
        await activeSdk?.shutdown();
        activeSdk = undefined;
      },
    };
  }

  const environment = options.environment ?? process.env.NODE_ENV ?? 'development';

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion ?? '0.1.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: environment,
    }),
    traceExporter: new OTLPTraceExporter({ url: resolveTracesEndpoint(options.endpoint) }),
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: shouldIgnoreIncoming,
      }),
      new ExpressInstrumentation({
        ignoreLayersType: [ExpressLayerType.MIDDLEWARE, ExpressLayerType.REQUEST_HANDLER],
      }),
      new IORedisInstrumentation(),
      new AmqplibInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
    ],
  });

  sdk.start();
  activeSdk = sdk;

  return {
    enabled: true,
    shutdown: async () => {
      await sdk.shutdown();
      activeSdk = undefined;
    },
  };
}

/** Flushes pending spans. Safe to call even when tracing never started. */
export async function shutdownTracing(): Promise<void> {
  if (!activeSdk) return;
  const sdk = activeSdk;
  activeSdk = undefined;
  await sdk.shutdown();
}

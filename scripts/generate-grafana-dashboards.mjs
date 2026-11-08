#!/usr/bin/env node
/**
 * Phase 11 — regenerates the version-controlled Grafana dashboards.
 *
 *   node scripts/generate-grafana-dashboards.mjs
 *
 * Keeping the panels in one generator makes the variable/query conventions
 * consistent across dashboards while the emitted JSON remains the deployable
 * artifact consumed by Docker Compose and Kubernetes.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(
  new URL('../infrastructure/docker/grafana/dashboards/', import.meta.url),
);

const PROM = { type: 'prometheus', uid: 'talent-prometheus' };
const PG = { type: 'postgres', uid: 'talent-analytics-db' };

const DASHBOARD_TAGS = ['talent.ai', 'phase-11', 'observability'];

function target(expr, legendFormat, datasource = PROM, extra = {}) {
  return {
    refId: extra.refId ?? 'A',
    datasource,
    expr,
    legendFormat,
    ...extra,
  };
}

function sqlTarget(rawSql, refId = 'A', format = 'table') {
  return { refId, datasource: PG, rawSql, format };
}

function thresholds(steps) {
  return {
    mode: 'absolute',
    steps: steps.map(([color, value]) => ({ color, value })),
  };
}

function statPanel({ id, title, grid, targets, unit = 'short', description, steps, decimals = 2 }) {
  return {
    id,
    type: 'stat',
    title,
    description,
    gridPos: grid,
    datasource: targets[0]?.datasource ?? PROM,
    fieldConfig: {
      defaults: {
        unit,
        decimals,
        ...(steps ? { thresholds: thresholds(steps) } : {}),
      },
      overrides: [],
    },
    options: {
      reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
      colorMode: steps ? 'background' : 'value',
      graphMode: 'area',
      textMode: 'auto',
      justifyMode: 'auto',
    },
    targets,
  };
}

function tsPanel({ id, title, grid, targets, unit = 'short', description, stack = false, steps }) {
  return {
    id,
    type: 'timeseries',
    title,
    description,
    gridPos: grid,
    datasource: targets[0]?.datasource ?? PROM,
    fieldConfig: {
      defaults: {
        unit,
        ...(steps ? { thresholds: thresholds(steps) } : {}),
        custom: {
          drawStyle: 'line',
          lineInterpolation: 'smooth',
          lineWidth: 2,
          fillOpacity: stack ? 20 : 5,
          showPoints: 'never',
          stacking: { mode: stack ? 'normal' : 'none', group: 'A' },
        },
      },
      overrides: [],
    },
    options: {
      legend: { displayMode: 'table', placement: 'bottom', calcs: ['mean', 'max', 'lastNotNull'] },
      tooltip: { mode: 'multi', sort: 'desc' },
    },
    targets,
  };
}

function tablePanel({ id, title, grid, targets, description, unit = 'short' }) {
  return {
    id,
    type: 'table',
    title,
    description,
    gridPos: grid,
    datasource: targets[0]?.datasource ?? PROM,
    fieldConfig: { defaults: { unit, custom: { align: 'auto' } }, overrides: [] },
    options: {
      showHeader: true,
      cellHeight: 'sm',
      footer: { show: false, reducers: [] },
    },
    targets,
  };
}

function barGaugePanel({ id, title, grid, targets, unit = 'short', description }) {
  return {
    id,
    type: 'bargauge',
    title,
    description,
    gridPos: grid,
    datasource: targets[0]?.datasource ?? PROM,
    fieldConfig: {
      defaults: {
        unit,
        min: 0,
        thresholds: thresholds([
          ['green', null],
          ['orange', 0.5],
          ['red', 1],
        ]),
      },
      overrides: [],
    },
    options: {
      orientation: 'horizontal',
      displayMode: 'gradient',
      showUnfilled: true,
      valueMode: 'color',
      namePlacement: 'left',
    },
    targets,
  };
}

function rowPanel(id, title, y) {
  return {
    id,
    type: 'row',
    title,
    collapsed: false,
    gridPos: { x: 0, y, w: 24, h: 1 },
    panels: [],
  };
}

function textPanel(id, title, grid, content) {
  return {
    id,
    type: 'text',
    title,
    gridPos: grid,
    options: { mode: 'markdown', code: { language: 'plaintext', showLineNumbers: false }, content },
  };
}

const environmentVariable = {
  name: 'env',
  label: 'Environment',
  type: 'query',
  datasource: PROM,
  query: { query: 'label_values(up{job="talent-services"}, env)', refId: 'StandardVariableQuery' },
  definition: 'label_values(up{job="talent-services"}, env)',
  includeAll: true,
  allValue: '.*',
  multi: true,
  current: { selected: true, text: 'All', value: '$__all' },
  refresh: 2,
  sort: 1,
  hide: 0,
};

const serviceVariable = {
  name: 'service',
  label: 'Service',
  type: 'query',
  datasource: PROM,
  query: {
    query: 'label_values(up{job="talent-services",env=~"$env"}, service)',
    refId: 'StandardVariableQuery',
  },
  definition: 'label_values(up{job="talent-services",env=~"$env"}, service)',
  includeAll: true,
  allValue: '.*',
  multi: true,
  current: { selected: true, text: 'All', value: '$__all' },
  refresh: 2,
  sort: 1,
  hide: 0,
};

const rangeVariable = {
  name: 'range',
  label: 'Rate window',
  type: 'interval',
  query: '1m,5m,15m,1h,6h',
  current: { selected: true, text: '5m', value: '5m' },
  auto: false,
  hide: 0,
};

const routeVariable = {
  name: 'route',
  label: 'Route',
  type: 'query',
  datasource: PROM,
  query: {
    query: 'label_values(http_requests_total{env=~"$env",service=~"$service"}, route)',
    refId: 'StandardVariableQuery',
  },
  definition: 'label_values(http_requests_total{env=~"$env",service=~"$service"}, route)',
  includeAll: true,
  allValue: '.*',
  multi: true,
  current: { selected: true, text: 'All', value: '$__all' },
  refresh: 2,
  sort: 1,
  hide: 0,
};

const statusVariable = {
  name: 'status_code',
  label: 'Status',
  type: 'query',
  datasource: PROM,
  query: {
    query:
      'label_values(http_requests_total{env=~"$env",service=~"$service",route=~"$route"}, status_code)',
    refId: 'StandardVariableQuery',
  },
  definition:
    'label_values(http_requests_total{env=~"$env",service=~"$service",route=~"$route"}, status_code)',
  includeAll: true,
  allValue: '.*',
  multi: true,
  current: { selected: true, text: 'All', value: '$__all' },
  refresh: 2,
  sort: 1,
  hide: 0,
};

const eventTypeVariable = {
  name: 'event_type',
  label: 'Event type',
  type: 'query',
  datasource: PROM,
  query: {
    query:
      'label_values(talent_domain_events_published_total{env=~"$env",service=~"$service"}, event_type)',
    refId: 'StandardVariableQuery',
  },
  definition:
    'label_values(talent_domain_events_published_total{env=~"$env",service=~"$service"}, event_type)',
  includeAll: true,
  allValue: '.*',
  multi: true,
  current: { selected: true, text: 'All', value: '$__all' },
  refresh: 2,
  sort: 1,
  hide: 0,
};

function dashboard(uid, title, { variables, panels, from = 'now-6h', description }) {
  return {
    uid,
    title,
    description,
    tags: DASHBOARD_TAGS,
    timezone: 'browser',
    schemaVersion: 39,
    version: 1,
    refresh: '30s',
    time: { from, to: 'now' },
    templating: { list: variables },
    annotations: { list: [] },
    links: [
      {
        title: 'talent.ai observability runbooks',
        url: 'https://github.com/VijeshVS/talent.ai/tree/main/docs/runbooks',
        type: 'link',
        icon: 'doc',
        targetBlank: true,
      },
    ],
    panels,
  };
}

const SELECTOR = 'env=~"$env",service=~"$service"';

function platformOverview() {
  let id = 0;
  const next = () => ++id;

  return dashboard('talent-platform-overview', 'talent.ai — Platform Overview', {
    description:
      'Golden signals for the whole platform: scrape health, request rate, error rate, latency and in-flight work.',
    variables: [environmentVariable, serviceVariable, rangeVariable],
    panels: [
      statPanel({
        id: next(),
        title: 'Services up',
        grid: { x: 0, y: 0, w: 4, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [
          target('count(up{job="talent-services",env=~"$env",service=~"$service"} == 1)', 'up'),
        ],
        steps: [
          ['red', null],
          ['green', 1],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Services down',
        grid: { x: 4, y: 0, w: 4, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [
          target('count(up{job="talent-services",env=~"$env",service=~"$service"} == 0)', 'down'),
        ],
        steps: [
          ['green', null],
          ['red', 1],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Requests / second',
        grid: { x: 8, y: 0, w: 4, h: 5 },
        unit: 'reqps',
        targets: [
          target(
            `sum(rate(http_requests_total{${SELECTOR},route=~"$route"}[$range]))`,
            'all services',
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: '5xx error rate',
        grid: { x: 12, y: 0, w: 4, h: 5 },
        unit: 'percentunit',
        targets: [
          target(
            `sum(rate(http_requests_total{${SELECTOR},route=~"$route",status_code=~"5.."}[$range])) / clamp_min(sum(rate(http_requests_total{${SELECTOR},route=~"$route"}[$range])), 0.000001)`,
            '5xx',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.01],
          ['red', 0.05],
        ],
      }),
      statPanel({
        id: next(),
        title: 'p95 latency',
        grid: { x: 16, y: 0, w: 4, h: 5 },
        unit: 's',
        targets: [
          target(
            `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{${SELECTOR},route=~"$route",status_code=~"$status_code"}[$range])) by (le))`,
            'p95',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.75],
          ['red', 2],
        ],
      }),
      statPanel({
        id: next(),
        title: 'In-flight requests',
        grid: { x: 20, y: 0, w: 4, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [target('sum(http_requests_in_flight{env=~"$env",service=~"$service"})', 'in-flight')],
      }),
      tsPanel({
        id: next(),
        title: 'Request rate by service',
        grid: { x: 0, y: 5, w: 12, h: 9 },
        unit: 'reqps',
        targets: [
          target(
            `sum by (service) (rate(http_requests_total{${SELECTOR},route=~"$route"}[$range]))`,
            '{{service}}',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Error rate by service',
        grid: { x: 12, y: 5, w: 12, h: 9 },
        unit: 'percentunit',
        targets: [
          target(
            `sum by (service) (rate(http_requests_total{${SELECTOR},route=~"$route",status_code=~"5.."}[$range])) / clamp_min(sum by (service) (rate(http_requests_total{${SELECTOR},route=~"$route"}[$range])), 0.000001)`,
            '{{service}}',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.01],
          ['red', 0.05],
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Latency percentiles by service',
        grid: { x: 0, y: 14, w: 12, h: 9 },
        unit: 's',
        targets: [
          target(
            `histogram_quantile(0.50, sum by (service, le) (rate(http_request_duration_seconds_bucket{${SELECTOR},route=~"$route",status_code=~"$status_code"}[$range])))`,
            '{{service}} p50',
            PROM,
            { refId: 'A' },
          ),
          target(
            `histogram_quantile(0.95, sum by (service, le) (rate(http_request_duration_seconds_bucket{${SELECTOR},route=~"$route",status_code=~"$status_code"}[$range])))`,
            '{{service}} p95',
            PROM,
            { refId: 'B' },
          ),
          target(
            `histogram_quantile(0.99, sum by (service, le) (rate(http_request_duration_seconds_bucket{${SELECTOR},route=~"$route",status_code=~"$status_code"}[$range])))`,
            '{{service}} p99',
            PROM,
            { refId: 'C' },
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Requests by status code',
        grid: { x: 12, y: 14, w: 12, h: 9 },
        unit: 'reqps',
        stack: true,
        targets: [
          target(
            `sum by (status_code) (rate(http_requests_total{${SELECTOR},route=~"$route",status_code=~"$status_code"}[$range]))`,
            '{{status_code}}',
          ),
        ],
      }),
      textPanel(
        next(),
        'Critical flows',
        { x: 0, y: 23, w: 24, h: 5 },
        [
          '| Flow | Where to look |',
          '| :--- | :--- |',
          '| Candidate onboarding → profile completion → AI summary | Conversion funnels, AI/TalentLens |',
          '| Recruiter search → TalentLens → TalentSwipe → review | AI/TalentLens, Service health |',
          '| Review → TalentCredits → Level-3 unlock Saga | Rewards, notifications & analytics |',
          '| Domain events → notification → analytics projection | Events & RabbitMQ, Rewards, notifications & analytics |',
        ].join('\n'),
      ),
    ],
  });
}

function serviceHealth() {
  let id = 100;
  const next = () => ++id;
  const sel = 'env=~"$env",service=~"$service"';

  return dashboard('talent-service-health', 'talent.ai — Service Health, RED & Saturation', {
    description:
      'Per-service RED metrics, Node process saturation, exporter connectivity and the slowest routes.',
    variables: [environmentVariable, serviceVariable, routeVariable, statusVariable, rangeVariable],
    panels: [
      statPanel({
        id: next(),
        title: 'Targets up',
        grid: { x: 0, y: 0, w: 4, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [
          target('count(up{job="talent-services",env=~"$env",service=~"$service"} == 1)', 'up'),
        ],
        steps: [
          ['red', null],
          ['green', 1],
        ],
      }),
      statPanel({
        id: next(),
        title: 'p95 latency',
        grid: { x: 4, y: 0, w: 5, h: 5 },
        unit: 's',
        targets: [
          target(
            `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{${sel},route=~"$route",status_code=~"$status_code"}[$range])) by (le))`,
            'p95',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.75],
          ['red', 2],
        ],
      }),
      statPanel({
        id: next(),
        title: 'p99 latency',
        grid: { x: 9, y: 0, w: 5, h: 5 },
        unit: 's',
        targets: [
          target(
            `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{${sel},route=~"$route",status_code=~"$status_code"}[$range])) by (le))`,
            'p99',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 1.5],
          ['red', 5],
        ],
      }),
      statPanel({
        id: next(),
        title: '5xx error rate',
        grid: { x: 14, y: 0, w: 5, h: 5 },
        unit: 'percentunit',
        targets: [
          target(
            `sum(rate(http_requests_total{${sel},route=~"$route",status_code=~"5.."}[$range])) / clamp_min(sum(rate(http_requests_total{${sel},route=~"$route"}[$range])), 0.000001)`,
            '5xx',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.01],
          ['red', 0.05],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Error budget burn (1h)',
        grid: { x: 19, y: 0, w: 5, h: 5 },
        unit: 'percentunit',
        targets: [
          target(
            `sum(rate(http_requests_total{${sel},route=~"$route",status_code=~"5.."}[1h])) / clamp_min(sum(rate(http_requests_total{${sel},route=~"$route"}[1h])), 0.000001)`,
            'burn',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.05],
          ['red', 0.15],
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Request rate by route',
        grid: { x: 0, y: 5, w: 12, h: 8 },
        unit: 'reqps',
        targets: [
          target(
            `sum by (service, route) (rate(http_requests_total{${sel},route=~"$route"}[$range]))`,
            '{{service}} {{route}}',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: '5xx rate by route',
        grid: { x: 12, y: 5, w: 12, h: 8 },
        unit: 'reqps',
        targets: [
          target(
            `sum by (service, route) (rate(http_requests_total{${sel},route=~"$route",status_code=~"5.."}[$range]))`,
            '{{service}} {{route}}',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.05],
          ['red', 0.5],
        ],
      }),
      tsPanel({
        id: next(),
        title: 'CPU usage by service',
        grid: { x: 0, y: 13, w: 8, h: 8 },
        unit: 'percentunit',
        targets: [
          target(
            `sum by (service) (rate(talent_process_cpu_seconds_total{env=~"$env",service=~"$service"}[$range]))`,
            '{{service}}',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Resident memory by service',
        grid: { x: 8, y: 13, w: 8, h: 8 },
        unit: 'bytes',
        targets: [
          target(
            `sum by (service) (talent_process_resident_memory_bytes{env=~"$env",service=~"$service"})`,
            '{{service}}',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Event-loop lag p99',
        grid: { x: 16, y: 13, w: 8, h: 8 },
        unit: 's',
        targets: [
          target(
            `max by (service) (talent_nodejs_eventloop_lag_p99_seconds{env=~"$env",service=~"$service"})`,
            '{{service}}',
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: 'PostgreSQL up',
        grid: { x: 0, y: 21, w: 3, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [target('min(pg_up{env=~"$env"})', 'pg_up')],
        steps: [
          ['red', null],
          ['green', 1],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Redis up',
        grid: { x: 3, y: 21, w: 3, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [target('min(redis_up{env=~"$env"})', 'redis_up')],
        steps: [
          ['red', null],
          ['green', 1],
        ],
      }),
      statPanel({
        id: next(),
        title: 'MongoDB up',
        grid: { x: 6, y: 21, w: 3, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [target('min(mongodb_up{env=~"$env"})', 'mongodb_up')],
        steps: [
          ['red', null],
          ['green', 1],
        ],
      }),
      statPanel({
        id: next(),
        title: 'RabbitMQ up',
        grid: { x: 9, y: 21, w: 3, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [target('min(up{job="rabbitmq",env=~"$env"})', 'rabbitmq')],
        steps: [
          ['red', null],
          ['green', 1],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Qdrant up',
        grid: { x: 12, y: 21, w: 3, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [target('min(up{job="qdrant",env=~"$env"})', 'qdrant')],
        steps: [
          ['red', null],
          ['green', 1],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Active DB connections',
        grid: { x: 15, y: 21, w: 4, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [target('sum(pg_stat_activity_count{env=~"$env",state="active"})', 'active')],
      }),
      tablePanel({
        id: next(),
        title: 'Slowest routes (p95)',
        grid: { x: 19, y: 21, w: 5, h: 8 },
        unit: 's',
        targets: [
          target(
            `topk(10, histogram_quantile(0.95, sum by (service, route, le) (rate(http_request_duration_seconds_bucket{${sel},route=~"$route",status_code=~"$status_code"}[$range]))))`,
            '{{service}} {{route}}',
            PROM,
            { format: 'table', instant: true },
          ),
        ],
      }),
    ],
  });
}

function conversionFunnels() {
  let id = 200;
  const next = () => ++id;

  return dashboard('talent-conversion-funnels', 'talent.ai — Candidate & Recruiter Conversion Funnels', {
    description:
      'Business funnels from the analytics read models (PostgreSQL) plus Prometheus business counters.',
    variables: [environmentVariable, serviceVariable, rangeVariable],
    from: 'now-30d',
    panels: [
      barGaugePanel({
        id: next(),
        title: 'Candidate journey funnel',
        grid: { x: 0, y: 0, w: 8, h: 9 },
        description:
          'Distinct candidates at each stage: onboarded profile, first approval, reviewed, then Level-3 unlock.',
        unit: 'short',
        targets: [
          sqlTarget(
            `SELECT '1. Profile created' AS stage, count(*)::float AS value
FROM candidate_metrics WHERE profile_created_at IS NOT NULL
UNION ALL
SELECT '2. First approval', count(*)::float FROM candidate_metrics WHERE first_approved_at IS NOT NULL
UNION ALL
SELECT '3. Reviewed', count(*)::float FROM candidate_metrics WHERE total_reviews > 0
UNION ALL
SELECT '4. Level-3 unlocks', coalesce(sum(tier3_unlocks), 0)::float FROM funnel_aggregates`,
          ),
        ],
      }),
      barGaugePanel({
        id: next(),
        title: 'Recruiter journey funnel',
        grid: { x: 8, y: 0, w: 8, h: 9 },
        description: 'Recruiters with open jobs, swipes, reviews and at least one approval.',
        unit: 'short',
        targets: [
          sqlTarget(
            `SELECT '1. Open jobs' AS stage, count(*)::float AS value FROM recruiter_metrics WHERE open_jobs > 0
UNION ALL
SELECT '2. Swiped', count(*)::float FROM (SELECT recruiter_id FROM recruiter_metrics WHERE approvals + rejections > 0) s
UNION ALL
SELECT '3. Reviewed', count(*)::float FROM recruiter_metrics WHERE reviews_submitted > 0
UNION ALL
SELECT '4. Approved', count(*)::float FROM recruiter_metrics WHERE approvals > 0`,
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: 'Review rate',
        grid: { x: 16, y: 0, w: 4, h: 5 },
        unit: 'percentunit',
        targets: [
          sqlTarget(
            `SELECT CASE WHEN coalesce(sum(swipes_recorded), 0) = 0 THEN 0
       ELSE coalesce(sum(reviews_submitted), 0)::float / sum(swipes_recorded)
       END AS value
FROM funnel_aggregates`,
          ),
        ],
        steps: [
          ['red', null],
          ['orange', 0.1],
          ['green', 0.25],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Approve / reject ratio',
        grid: { x: 20, y: 0, w: 4, h: 5 },
        unit: 'percentunit',
        targets: [
          sqlTarget(
            `SELECT CASE WHEN coalesce(sum(approvals + rejections), 0) = 0 THEN 0
       ELSE sum(approvals)::float / sum(approvals + rejections)
       END AS value
FROM recruiter_metrics`,
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: 'TalentCredits awarded',
        grid: { x: 16, y: 5, w: 4, h: 4 },
        unit: 'short',
        decimals: 0,
        targets: [
          target(
            'sum(increase(talent_rewards_ledger_transactions_total{env=~"$env",service=~"$service"}[$__range]))',
            'credits',
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: 'Unlock conversion',
        grid: { x: 20, y: 5, w: 4, h: 4 },
        unit: 'percentunit',
        targets: [
          target(
            'sum(increase(talent_rewards_saga_total{env=~"$env",saga="tier3_unlock",outcome="granted"}[$__range])) / clamp_min(sum(increase(talent_ai_talent_lens_searches_total{env=~"$env"}[$__range])), 0.000001)',
            'unlocks / searches',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Daily funnel volume',
        grid: { x: 0, y: 9, w: 16, h: 9 },
        unit: 'short',
        targets: [
          sqlTarget(
            `SELECT day AS time,
       profiles_created AS "Profiles created",
       swipes_recorded AS "Swipes recorded",
       reviews_submitted AS "Reviews submitted",
       approvals AS "Approvals",
       tier3_unlocks AS "Tier-3 unlocks"
FROM funnel_aggregates
ORDER BY day`,
            'A',
            'time_series',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Approvals & rejections (analytics)',
        grid: { x: 16, y: 9, w: 8, h: 9 },
        unit: 'short',
        targets: [
          sqlTarget(
            `SELECT day AS time,
       approvals AS "Approvals",
       swipes_recorded - approvals AS "Other swipe outcomes"
FROM funnel_aggregates
ORDER BY day`,
            'A',
            'time_series',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'TalentLens search outcomes',
        grid: { x: 0, y: 18, w: 8, h: 8 },
        unit: 'reqps',
        targets: [
          target(
            'sum by (outcome) (rate(talent_ai_talent_lens_searches_total{env=~"$env",service=~"$service"}[$range]))',
            '{{outcome}}',
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: 'Average time to first approval',
        grid: { x: 8, y: 18, w: 8, h: 8 },
        unit: 's',
        targets: [
          sqlTarget(
            `SELECT coalesce(avg(extract(epoch FROM (first_approved_at - profile_created_at))), 0) AS value
FROM candidate_metrics
WHERE first_approved_at IS NOT NULL AND profile_created_at IS NOT NULL`,
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: 'Notification delivery rate',
        grid: { x: 16, y: 18, w: 4, h: 8 },
        unit: 'percentunit',
        targets: [
          target(
            'sum(rate(talent_notifications_created_total{env=~"$env",delivery_status="SENT"}[$range])) / clamp_min(sum(rate(talent_notifications_created_total{env=~"$env"}[$range])), 0.000001)',
            'delivery',
          ),
        ],
        steps: [
          ['red', null],
          ['orange', 0.95],
          ['green', 0.99],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Analytics projection freshness',
        grid: { x: 20, y: 18, w: 4, h: 8 },
        unit: 's',
        targets: [
          sqlTarget(`SELECT coalesce(extract(epoch FROM (now() - max(processed_at))), 0) AS value
FROM processed_events`),
        ],
        steps: [
          ['green', null],
          ['orange', 60],
          ['red', 300],
        ],
      }),
    ],
  });
}

function aiTalentLens() {
  let id = 300;
  const next = () => ++id;
  const sel = 'env=~"$env",service=~"$service"';

  return dashboard('talent-ai-talentlens', 'talent.ai — AI & TalentLens', {
    description:
      'TalentLens throughput, provider latency/failures, fallback behaviour, cache hit rate and circuit-breaker state.',
    variables: [environmentVariable, serviceVariable, rangeVariable],
    panels: [
      statPanel({
        id: next(),
        title: 'TalentLens searches / s',
        grid: { x: 0, y: 0, w: 4, h: 5 },
        unit: 'reqps',
        targets: [
          target(
            'sum(rate(talent_ai_talent_lens_searches_total{env=~"$env",service=~"$service"}[$range]))',
            'searches',
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: 'Provider failure rate',
        grid: { x: 4, y: 0, w: 4, h: 5 },
        unit: 'percentunit',
        targets: [
          target(
            'sum(rate(talent_ai_provider_requests_total{env=~"$env",service=~"$service",outcome=~"error|circuit_open|unconfigured"}[$range])) / clamp_min(sum(rate(talent_ai_provider_requests_total{env=~"$env",service=~"$service"}[$range])), 0.000001)',
            'failed',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.05],
          ['red', 0.2],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Cache hit rate',
        grid: { x: 8, y: 0, w: 4, h: 5 },
        unit: 'percentunit',
        targets: [
          target(
            'sum(rate(talent_ai_cache_requests_total{env=~"$env",service=~"$service",result="hit"}[$range])) / clamp_min(sum(rate(talent_ai_cache_requests_total{env=~"$env",service=~"$service",result=~"hit|miss"}[$range])), 0.000001)',
            'hit rate',
          ),
        ],
        steps: [
          ['red', null],
          ['orange', 0.2],
          ['green', 0.5],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Circuit breaker state',
        grid: { x: 12, y: 0, w: 4, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [
          target(
            'max by (breaker) (talent_ai_circuit_breaker_state{env=~"$env",service=~"$service"})',
            '{{breaker}}',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 1],
          ['red', 2],
        ],
      }),
      statPanel({
        id: next(),
        title: 'AI HTTP 5xx rate',
        grid: { x: 16, y: 0, w: 4, h: 5 },
        unit: 'percentunit',
        targets: [
          target(
            'sum(rate(http_requests_total{env=~"$env",service="ai-matching-service",route=~"/api/v1/ai/.*",status_code=~"5.."}[$range])) / clamp_min(sum(rate(http_requests_total{env=~"$env",service="ai-matching-service",route=~"/api/v1/ai/.*"}[$range])), 0.000001)',
            '5xx',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.01],
          ['red', 0.05],
        ],
      }),
      statPanel({
        id: next(),
        title: 'p95 TalentLens latency',
        grid: { x: 20, y: 0, w: 4, h: 5 },
        unit: 's',
        targets: [
          target(
            'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{env=~"$env",service="ai-matching-service",route=~"/api/v1/ai/.*"}[$range])) by (le))',
            'p95',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 1],
          ['red', 5],
        ],
      }),
      tsPanel({
        id: next(),
        title: 'TalentLens latency percentiles',
        grid: { x: 0, y: 5, w: 12, h: 9 },
        unit: 's',
        targets: [
          target(
            'histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{env=~"$env",service="ai-matching-service",route=~"/api/v1/ai/.*"}[$range])) by (le))',
            'p50',
            PROM,
            { refId: 'A' },
          ),
          target(
            'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{env=~"$env",service="ai-matching-service",route=~"/api/v1/ai/.*"}[$range])) by (le))',
            'p95',
            PROM,
            { refId: 'B' },
          ),
          target(
            'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{env=~"$env",service="ai-matching-service",route=~"/api/v1/ai/.*"}[$range])) by (le))',
            'p99',
            PROM,
            { refId: 'C' },
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Provider calls by outcome',
        grid: { x: 12, y: 5, w: 12, h: 9 },
        unit: 'reqps',
        stack: true,
        targets: [
          target(
            'sum by (provider, outcome) (rate(talent_ai_provider_requests_total{env=~"$env",service=~"$service"}[$range]))',
            '{{provider}} {{outcome}}',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Provider latency by provider',
        grid: { x: 0, y: 14, w: 12, h: 9 },
        unit: 's',
        targets: [
          target(
            'histogram_quantile(0.95, sum by (provider, le) (rate(talent_ai_provider_request_duration_seconds_bucket{env=~"$env",service=~"$service"}[$range])))',
            '{{provider}} p95',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Cache lookups by namespace',
        grid: { x: 12, y: 14, w: 12, h: 9 },
        unit: 'reqps',
        targets: [
          target(
            'sum by (cache, result) (rate(talent_ai_cache_requests_total{env=~"$env",service=~"$service"}[$range]))',
            '{{cache}} {{result}}',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Fallback / circuit-open calls',
        grid: { x: 0, y: 23, w: 12, h: 7 },
        unit: 'reqps',
        targets: [
          target(
            'sum by (provider, outcome) (rate(talent_ai_provider_requests_total{env=~"$env",service=~"$service",outcome=~"circuit_open|unconfigured"}[$range]))',
            '{{provider}} {{outcome}}',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'TalentLens outcomes',
        grid: { x: 12, y: 23, w: 12, h: 7 },
        unit: 'reqps',
        stack: true,
        targets: [
          target(
            'sum by (outcome) (rate(talent_ai_talent_lens_searches_total{env=~"$env",service=~"$service"}[$range]))',
            '{{outcome}}',
          ),
        ],
      }),
    ],
  });
}

function eventsRabbitMq() {
  let id = 400;
  const next = () => ++id;

  return dashboard('talent-events-rabbitmq', 'talent.ai — Domain Events & RabbitMQ', {
    description:
      'Event publish/consume rates, handler failures, queue depth, consumer lag, retries and dead-letter growth.',
    variables: [environmentVariable, serviceVariable, eventTypeVariable, rangeVariable],
    panels: [
      statPanel({
        id: next(),
        title: 'Publish rate',
        grid: { x: 0, y: 0, w: 4, h: 5 },
        unit: 'ops',
        targets: [
          target(
            'sum(rate(talent_domain_events_published_total{env=~"$env",service=~"$service",event_type=~"$event_type"}[$range]))',
            'published',
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: 'Consume rate',
        grid: { x: 4, y: 0, w: 4, h: 5 },
        unit: 'ops',
        targets: [
          target(
            'sum(rate(talent_domain_events_consumed_total{env=~"$env",service=~"$service",event_type=~"$event_type",outcome="success"}[$range]))',
            'consumed',
          ),
        ],
      }),
      statPanel({
        id: next(),
        title: 'Handler failure rate',
        grid: { x: 8, y: 0, w: 4, h: 5 },
        unit: 'percentunit',
        targets: [
          target(
            'sum(rate(talent_domain_events_consumed_total{env=~"$env",service=~"$service",event_type=~"$event_type",outcome="failure"}[$range])) / clamp_min(sum(rate(talent_domain_events_consumed_total{env=~"$env",service=~"$service",event_type=~"$event_type"}[$range])), 0.000001)',
            'failed',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.01],
          ['red', 0.1],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Ready messages',
        grid: { x: 12, y: 0, w: 4, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [target('sum(rabbitmq_queue_messages_ready{env=~"$env"})', 'ready')],
        steps: [
          ['green', null],
          ['orange', 100],
          ['red', 1000],
        ],
      }),
      statPanel({
        id: next(),
        title: 'Unacked / consumer lag',
        grid: { x: 16, y: 0, w: 4, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [target('sum(rabbitmq_queue_messages_unacked{env=~"$env"})', 'unacked')],
        steps: [
          ['green', null],
          ['orange', 100],
          ['red', 500],
        ],
      }),
      statPanel({
        id: next(),
        title: 'DLQ depth',
        grid: { x: 20, y: 0, w: 4, h: 5 },
        unit: 'short',
        decimals: 0,
        targets: [
          target(
            'sum(rabbitmq_queue_messages_ready{env=~"$env",queue="talent.events.dlq"})',
            'dlq',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 1],
          ['red', 10],
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Event rate by type',
        grid: { x: 0, y: 5, w: 12, h: 9 },
        unit: 'ops',
        targets: [
          target(
            'sum by (event_type) (rate(talent_domain_events_published_total{env=~"$env",service=~"$service",event_type=~"$event_type"}[$range]))',
            'published {{event_type}}',
            PROM,
            { refId: 'A' },
          ),
          target(
            'sum by (event_type) (rate(talent_domain_events_consumed_total{env=~"$env",service=~"$service",event_type=~"$event_type",outcome="success"}[$range]))',
            'consumed {{event_type}}',
            PROM,
            { refId: 'B' },
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Handler failures by event type',
        grid: { x: 12, y: 5, w: 12, h: 9 },
        unit: 'ops',
        targets: [
          target(
            'sum by (event_type) (rate(talent_domain_events_consumed_total{env=~"$env",service=~"$service",event_type=~"$event_type",outcome="failure"}[$range]))',
            '{{event_type}}',
          ),
        ],
        steps: [
          ['green', null],
          ['orange', 0.01],
          ['red', 0.1],
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Event handler p95 latency',
        grid: { x: 0, y: 14, w: 12, h: 9 },
        unit: 's',
        targets: [
          target(
            'histogram_quantile(0.95, sum by (event_type, le) (rate(talent_domain_event_processing_seconds_bucket{env=~"$env",service=~"$service",event_type=~"$event_type"}[$range])))',
            '{{event_type}}',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Queue depth by queue',
        grid: { x: 12, y: 14, w: 12, h: 9 },
        unit: 'short',
        targets: [
          target(
            'sum by (queue) (rabbitmq_queue_messages_ready{env=~"$env"})',
            '{{queue}}',
          ),
        ],
      }),
      tsPanel({
        id: next(),
        title: 'Publish / deliver / ack rates',
        grid: { x: 0, y: 23, w: 12, h: 8 },
        unit: 'ops',
        targets: [
          target(
            'sum(rate(rabbitmq_global_messages_routed_total{env=~"$env"}[$range]))',
            'routed',
            PROM,
            { refId: 'A' },
          ),
          target(
            'sum(rate(rabbitmq_global_messages_acknowledged_total{env=~"$env"}[$range]))',
            'acknowledged',
            PROM,
            { refId: 'B' },
          ),
          target(
            'sum(rate(rabbitmq_global_messages_unroutable_dropped_total{env=~"$env"}[$range]))',
            'unroutable',
            PROM,
            { refId: 'C' },
          ),
        ],
      }),
      tablePanel({
        id: next(),
        title: 'Queue consumer health',
        grid: { x: 12, y: 23, w: 12, h: 8 },
        unit: 'short',
        targets: [
          target(
            'rabbitmq_queue_consumers{env=~"$env"}',
            '{{queue}}',
            PROM,
            { format: 'table', instant: true },
          ),
        ],
      }),
    ],
  });
}

function rewardsNotificationsAnalytics() {
  let id = 500;
  const next = () => ++id;

  return dashboard(
    'talent-rewards-notifications-analytics',
    'talent.ai — Rewards, Notifications & Analytics Health',
    {
      description:
        'TalentCredits ledger activity, Saga outcomes, notification/email delivery and analytics projection freshness.',
      variables: [environmentVariable, serviceVariable, rangeVariable],
      panels: [
        statPanel({
          id: next(),
          title: 'Credits awarded / s',
          grid: { x: 0, y: 0, w: 4, h: 5 },
          unit: 'ops',
          targets: [
            target(
              'sum(rate(talent_rewards_ledger_transactions_total{env=~"$env",service=~"$service",type="CREDIT_REVIEW_FEEDBACK"}[$range]))',
              'review credits',
            ),
          ],
        }),
        statPanel({
          id: next(),
          title: 'Tier-3 unlocks / s',
          grid: { x: 4, y: 0, w: 4, h: 5 },
          unit: 'ops',
          targets: [
            target(
              'sum(rate(talent_rewards_saga_total{env=~"$env",service=~"$service",saga="tier3_unlock",outcome="granted"}[$range]))',
              'granted',
            ),
          ],
        }),
        statPanel({
          id: next(),
          title: 'Rewards 5xx rate',
          grid: { x: 8, y: 0, w: 4, h: 5 },
          unit: 'percentunit',
          targets: [
            target(
              'sum(rate(http_requests_total{env=~"$env",service="rewards-service",status_code=~"5.."}[$range])) / clamp_min(sum(rate(http_requests_total{env=~"$env",service="rewards-service"}[$range])), 0.000001)',
              '5xx',
            ),
          ],
          steps: [
            ['green', null],
            ['orange', 0.01],
            ['red', 0.05],
          ],
        }),
        statPanel({
          id: next(),
          title: 'Notifications created / s',
          grid: { x: 12, y: 0, w: 4, h: 5 },
          unit: 'ops',
          targets: [
            target(
              'sum(rate(talent_notifications_created_total{env=~"$env",service=~"$service"}[$range]))',
              'notifications',
            ),
          ],
        }),
        statPanel({
          id: next(),
          title: 'Email failure rate',
          grid: { x: 16, y: 0, w: 4, h: 5 },
          unit: 'percentunit',
          targets: [
            target(
              'sum(rate(talent_notification_email_total{env=~"$env",service=~"$service",status="FAILED"}[$range])) / clamp_min(sum(rate(talent_notification_email_total{env=~"$env",service=~"$service"}[$range])), 0.000001)',
              'failed',
            ),
          ],
          steps: [
            ['green', null],
            ['orange', 0.01],
            ['red', 0.1],
          ],
        }),
        statPanel({
          id: next(),
          title: 'Analytics p95 projection lag',
          grid: { x: 20, y: 0, w: 4, h: 5 },
          unit: 's',
          targets: [
            target(
              'histogram_quantile(0.95, sum(rate(talent_analytics_projection_lag_seconds_bucket{env=~"$env",service=~"$service"}[$range])) by (le))',
              'p95 lag',
            ),
          ],
          steps: [
            ['green', null],
            ['orange', 60],
            ['red', 300],
          ],
        }),
        tsPanel({
          id: next(),
          title: 'Ledger transactions by type',
          grid: { x: 0, y: 5, w: 12, h: 9 },
          unit: 'ops',
          targets: [
            target(
              'sum by (type) (rate(talent_rewards_ledger_transactions_total{env=~"$env",service=~"$service"}[$range]))',
              '{{type}}',
            ),
          ],
        }),
        tsPanel({
          id: next(),
          title: 'Rewards Saga outcomes',
          grid: { x: 12, y: 5, w: 12, h: 9 },
          unit: 'ops',
          stack: true,
          targets: [
            target(
              'sum by (saga, outcome) (rate(talent_rewards_saga_total{env=~"$env",service=~"$service"}[$range]))',
              '{{saga}} {{outcome}}',
            ),
          ],
        }),
        tsPanel({
          id: next(),
          title: 'Notifications by type',
          grid: { x: 0, y: 14, w: 12, h: 9 },
          unit: 'ops',
          stack: true,
          targets: [
            target(
              'sum by (type) (rate(talent_notifications_created_total{env=~"$env",service=~"$service"}[$range]))',
              '{{type}}',
            ),
          ],
        }),
        tsPanel({
          id: next(),
          title: 'Email delivery status',
          grid: { x: 12, y: 14, w: 12, h: 9 },
          unit: 'ops',
          stack: true,
          targets: [
            target(
              'sum by (status) (rate(talent_notification_email_total{env=~"$env",service=~"$service"}[$range]))',
              '{{status}}',
            ),
          ],
        }),
        tsPanel({
          id: next(),
          title: 'Analytics projection volume',
          grid: { x: 0, y: 23, w: 12, h: 9 },
          unit: 'ops',
          stack: true,
          targets: [
            target(
              'sum by (event_type) (rate(talent_analytics_events_processed_total{env=~"$env",service=~"$service"}[$range]))',
              '{{event_type}}',
            ),
          ],
        }),
        tsPanel({
          id: next(),
          title: 'Analytics projection lag by event type',
          grid: { x: 12, y: 23, w: 12, h: 9 },
          unit: 's',
          targets: [
            target(
              'histogram_quantile(0.95, sum by (event_type, le) (rate(talent_analytics_projection_lag_seconds_bucket{env=~"$env",service=~"$service"}[$range])))',
              '{{event_type}}',
            ),
          ],
        }),
        tablePanel({
          id: next(),
          title: 'Pipeline queue depth',
          grid: { x: 0, y: 32, w: 12, h: 8 },
          unit: 'short',
          targets: [
            target(
              'sum by (queue) (rabbitmq_queue_messages_ready{env=~"$env",queue=~"rewards-service.*|notification-service.*|analytics-service.*|ai-matching-service.*"})',
              '{{queue}}',
              PROM,
              { format: 'table', instant: true },
            ),
          ],
        }),
        tablePanel({
          id: next(),
          title: 'Consumer count by pipeline queue',
          grid: { x: 12, y: 32, w: 12, h: 8 },
          unit: 'short',
          targets: [
            target(
              'rabbitmq_queue_consumers{env=~"$env",queue=~"rewards-service.*|notification-service.*|analytics-service.*|ai-matching-service.*"}',
              '{{queue}}',
              PROM,
              { format: 'table', instant: true },
            ),
          ],
        }),
      ],
    },
  );
}

const dashboards = [
  platformOverview(),
  serviceHealth(),
  conversionFunnels(),
  aiTalentLens(),
  eventsRabbitMq(),
  rewardsNotificationsAnalytics(),
];

await mkdir(OUT_DIR, { recursive: true });

for (const item of dashboards) {
  const file = `${OUT_DIR}${item.uid}.json`;
  await writeFile(file, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
  console.log(`wrote ${file}`);
}

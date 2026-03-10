const MINUTE_MS = 60_000;
const MAX_CHART_POINTS = 72;

export const STATUS_PROBE_HEADER = "x-spike-status-probe";

export interface ServiceMetricRange {
  key: ServiceMetricRangeKey;
  label: string;
  windowMinutes: number;
}

export type ServiceMetricRangeKey = "60m" | "6h" | "24h";

export interface ServiceMetricPoint {
  bucketStartMs: number;
  requestCount: number;
  avgLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface ServiceMetricSummary {
  totalRequests: number;
  currentRpm: number;
  averageRpm: number;
  currentRpmDelta: number;
  peakRpm: number;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  meanLatencyMs: number | null;
  stddevLatencyMs: number | null;
  latestAvgLatencyMs: number | null;
  latestLatencyDeltaMs: number | null;
}

export interface ServiceMetricHistory {
  serviceName: string;
  range: ServiceMetricRange;
  points: ServiceMetricPoint[];
  chartPoints: Array<Pick<ServiceMetricPoint, "bucketStartMs" | "requestCount">>;
  summary: ServiceMetricSummary;
}

interface ServiceMetricRow {
  minute_bucket: number;
  request_count: number;
  latency_min_ms: number;
  latency_max_ms: number;
  latency_sum_ms: number;
  latency_sum_sq_ms: number;
}

const RANGES: Record<ServiceMetricRangeKey, ServiceMetricRange> = {
  "60m": { key: "60m", label: "Last 60 min", windowMinutes: 60 },
  "6h": { key: "6h", label: "Last 6 hours", windowMinutes: 6 * 60 },
  "24h": { key: "24h", label: "Last 24 hours", windowMinutes: 24 * 60 },
};

let schemaPromise: Promise<void> | null = null;

function floorToMinute(timestampMs: number): number {
  return Math.floor(timestampMs / MINUTE_MS) * MINUTE_MS;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function normalizeRow(value: unknown): ServiceMetricRow | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const row = value as Record<string, unknown>;
  const minuteBucket = toFiniteNumber(row.minute_bucket);
  const requestCount = toFiniteNumber(row.request_count);

  if (!minuteBucket) {
    return null;
  }

  return {
    minute_bucket: minuteBucket,
    request_count: requestCount,
    latency_min_ms: toFiniteNumber(row.latency_min_ms),
    latency_max_ms: toFiniteNumber(row.latency_max_ms),
    latency_sum_ms: toFiniteNumber(row.latency_sum_ms),
    latency_sum_sq_ms: toFiniteNumber(row.latency_sum_sq_ms),
  };
}

function createEmptyPoint(bucketStartMs: number): ServiceMetricPoint {
  return {
    bucketStartMs,
    requestCount: 0,
    avgLatencyMs: null,
    minLatencyMs: null,
    maxLatencyMs: null,
  };
}

function compressChartPoints(
  points: ServiceMetricPoint[],
): Array<Pick<ServiceMetricPoint, "bucketStartMs" | "requestCount">> {
  if (points.length <= MAX_CHART_POINTS) {
    return points.map((point) => ({
      bucketStartMs: point.bucketStartMs,
      requestCount: point.requestCount,
    }));
  }

  const groupSize = Math.ceil(points.length / MAX_CHART_POINTS);
  const compacted: Array<Pick<ServiceMetricPoint, "bucketStartMs" | "requestCount">> = [];

  for (let index = 0; index < points.length; index += groupSize) {
    const chunk = points.slice(index, index + groupSize);
    const firstPoint = chunk[0];

    if (!firstPoint) {
      continue;
    }

    compacted.push({
      bucketStartMs: firstPoint.bucketStartMs,
      requestCount: chunk.reduce((total, point) => total + point.requestCount, 0),
    });
  }

  return compacted;
}

function buildSummary(
  rows: ServiceMetricRow[],
  points: ServiceMetricPoint[],
  range: ServiceMetricRange,
): ServiceMetricSummary {
  const totalRequests = rows.reduce((total, row) => total + row.request_count, 0);
  const totalLatency = rows.reduce((total, row) => total + row.latency_sum_ms, 0);
  const totalLatencySquared = rows.reduce((total, row) => total + row.latency_sum_sq_ms, 0);
  const meanLatencyMs = totalRequests > 0 ? totalLatency / totalRequests : null;
  const variance =
    totalRequests > 0 && meanLatencyMs !== null
      ? Math.max(0, totalLatencySquared / totalRequests - meanLatencyMs ** 2)
      : null;
  const latestPoint = points[points.length - 1] ?? createEmptyPoint(Date.now());

  return {
    totalRequests,
    currentRpm: latestPoint.requestCount,
    averageRpm: totalRequests / range.windowMinutes,
    currentRpmDelta: latestPoint.requestCount - totalRequests / range.windowMinutes,
    peakRpm: points.reduce((peak, point) => Math.max(peak, point.requestCount), 0),
    minLatencyMs:
      rows.length > 0
        ? rows.reduce((min, row) => Math.min(min, row.latency_min_ms), Infinity)
        : null,
    maxLatencyMs:
      rows.length > 0
        ? rows.reduce((max, row) => Math.max(max, row.latency_max_ms), Number.NEGATIVE_INFINITY)
        : null,
    meanLatencyMs,
    stddevLatencyMs: variance === null ? null : Math.sqrt(variance),
    latestAvgLatencyMs: latestPoint.avgLatencyMs,
    latestLatencyDeltaMs:
      latestPoint.avgLatencyMs !== null && meanLatencyMs !== null
        ? latestPoint.avgLatencyMs - meanLatencyMs
        : null,
  };
}

export function parseServiceMetricRange(rangeKey?: string | null): ServiceMetricRange {
  if (rangeKey && rangeKey in RANGES) {
    return RANGES[rangeKey as ServiceMetricRangeKey];
  }

  return RANGES["6h"];
}

export function shouldTrackServiceMetricRequest(request: Request): boolean {
  if (request.method === "OPTIONS") {
    return false;
  }

  return request.headers.get(STATUS_PROBE_HEADER) !== "1";
}

export async function ensureServiceMetricSchema(db: D1Database): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = db
      .exec(`
        CREATE TABLE IF NOT EXISTS status_service_minute_metrics (
          service_name TEXT NOT NULL,
          minute_bucket INTEGER NOT NULL,
          request_count INTEGER NOT NULL DEFAULT 0,
          latency_min_ms REAL NOT NULL,
          latency_max_ms REAL NOT NULL,
          latency_sum_ms REAL NOT NULL DEFAULT 0,
          latency_sum_sq_ms REAL NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (service_name, minute_bucket)
        );
        CREATE INDEX IF NOT EXISTS idx_status_service_minute_metrics_bucket
          ON status_service_minute_metrics (minute_bucket DESC);
      `)
      .then((): void => undefined)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }

  await schemaPromise;
}

export async function recordServiceRequestMetric(
  db: D1Database,
  serviceName: string,
  latencyMs: number,
  now = Date.now(),
): Promise<void> {
  await ensureServiceMetricSchema(db);

  const roundedLatency = Math.max(0, latencyMs);
  const minuteBucket = floorToMinute(now);

  await db
    .prepare(
      `INSERT INTO status_service_minute_metrics (
         service_name,
         minute_bucket,
         request_count,
         latency_min_ms,
         latency_max_ms,
         latency_sum_ms,
         latency_sum_sq_ms,
         updated_at
       ) VALUES (?, ?, 1, ?, ?, ?, ?, ?)
       ON CONFLICT(service_name, minute_bucket) DO UPDATE SET
         request_count = status_service_minute_metrics.request_count + 1,
         latency_min_ms = MIN(status_service_minute_metrics.latency_min_ms, excluded.latency_min_ms),
         latency_max_ms = MAX(status_service_minute_metrics.latency_max_ms, excluded.latency_max_ms),
         latency_sum_ms = status_service_minute_metrics.latency_sum_ms + excluded.latency_sum_ms,
         latency_sum_sq_ms = status_service_minute_metrics.latency_sum_sq_ms + excluded.latency_sum_sq_ms,
         updated_at = excluded.updated_at`,
    )
    .bind(
      serviceName,
      minuteBucket,
      roundedLatency,
      roundedLatency,
      roundedLatency,
      roundedLatency * roundedLatency,
      now,
    )
    .run();
}

export function buildServiceMetricHistory(
  serviceName: string,
  rows: ServiceMetricRow[],
  range: ServiceMetricRange,
  now = Date.now(),
): ServiceMetricHistory {
  const currentBucket = floorToMinute(now);
  const firstBucket = currentBucket - (range.windowMinutes - 1) * MINUTE_MS;
  const rowsByBucket = new Map(rows.map((row) => [row.minute_bucket, row]));
  const points: ServiceMetricPoint[] = [];

  for (let bucket = firstBucket; bucket <= currentBucket; bucket += MINUTE_MS) {
    const row = rowsByBucket.get(bucket);

    if (!row || row.request_count <= 0) {
      points.push(createEmptyPoint(bucket));
      continue;
    }

    points.push({
      bucketStartMs: bucket,
      requestCount: row.request_count,
      avgLatencyMs: row.latency_sum_ms / row.request_count,
      minLatencyMs: row.latency_min_ms,
      maxLatencyMs: row.latency_max_ms,
    });
  }

  return {
    serviceName,
    range,
    points,
    chartPoints: compressChartPoints(points),
    summary: buildSummary(rows, points, range),
  };
}

export async function fetchServiceMetricHistory(
  db: D1Database,
  serviceName: string,
  rangeKey?: string | null,
  now = Date.now(),
): Promise<ServiceMetricHistory> {
  await ensureServiceMetricSchema(db);

  const range = parseServiceMetricRange(rangeKey);
  const currentBucket = floorToMinute(now);
  const firstBucket = currentBucket - (range.windowMinutes - 1) * MINUTE_MS;
  const result = await db
    .prepare(
      `SELECT
         minute_bucket,
         request_count,
         latency_min_ms,
         latency_max_ms,
         latency_sum_ms,
         latency_sum_sq_ms
       FROM status_service_minute_metrics
       WHERE service_name = ?
         AND minute_bucket >= ?
       ORDER BY minute_bucket ASC`,
    )
    .bind(serviceName, firstBucket)
    .all();

  const rows = (result.results ?? [])
    .map(normalizeRow)
    .filter((row): row is ServiceMetricRow => row !== null);

  return buildServiceMetricHistory(serviceName, rows, range, now);
}

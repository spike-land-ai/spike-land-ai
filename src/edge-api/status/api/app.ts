import { Hono } from "hono";
import {
  buildServiceMetricHistory,
  fetchServiceMetricHistory,
  parseServiceMetricRange,
  type ServiceMetricHistory,
  type ServiceMetricRange,
} from "../../common/core-logic/service-metrics.ts";
import type { Env } from "../core-logic/env.ts";
import {
  createStatusSnapshot,
  DEGRADED_THRESHOLD_MS,
  probeAll,
  SERVICES,
  TIMEOUT_MS,
  type ProbeResult,
} from "../core-logic/monitor.ts";

const app = new Hono<{ Bindings: Env }>();

interface StatusServiceView extends ProbeResult {
  history: ServiceMetricHistory;
}

interface DashboardPayload {
  overall: "operational" | "partial_degradation" | "major_outage";
  timestamp: string;
  range: ServiceMetricRange;
  summary: {
    up: number;
    degraded: number;
    down: number;
    total: number;
  };
  platform: {
    currentRpm: number;
    totalRequests: number;
    peakRpm: number;
    meanLatencyMs: number | null;
  };
  services: StatusServiceView[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits).replace(/\.0$/, "");
}

function formatRpm(value: number): string {
  return `${formatNumber(value, value >= 10 ? 0 : 1)} rpm`;
}

function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  if (value >= 1000) {
    return `${formatNumber(value / 1000, 2)}s`;
  }

  return `${formatNumber(value, value >= 100 ? 0 : 1)}ms`;
}

function formatSignedDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  const sign = value > 0 ? "+" : value < 0 ? "-" : "±";
  return `${sign}${formatDuration(Math.abs(value))}`;
}

function renderRequestChart(history: ServiceMetricHistory): string {
  const points = history.chartPoints;
  const width = 320;
  const height = 88;
  const floor = height - 8;
  const gradientId = `rpm-gradient-${history.serviceName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const maxRequests = Math.max(1, ...points.map((point) => point.requestCount));
  const slotWidth = width / Math.max(points.length, 1);
  const barWidth = Math.max(2, slotWidth - 1.5);
  const averageLineY = floor - (history.summary.averageRpm / maxRequests) * (height - 18);

  const bars = points
    .map((point, index) => {
      const barHeight =
        point.requestCount === 0
          ? 3
          : Math.max(4, (point.requestCount / maxRequests) * (height - 18));
      const x = index * slotWidth;
      const y = floor - barHeight;
      const className = index === points.length - 1 ? "chart-bar latest" : "chart-bar";

      return `<rect class="${className}" style="--chart-fill:url(#${gradientId})" x="${formatNumber(x, 2)}" y="${formatNumber(
        y,
        2,
      )}" width="${formatNumber(barWidth, 2)}" height="${formatNumber(barHeight, 2)}" rx="2" />`;
    })
    .join("");

  const averageGuide =
    history.summary.totalRequests > 0
      ? `<line class="chart-average" x1="0" y1="${formatNumber(averageLineY, 2)}" x2="${width}" y2="${formatNumber(
          averageLineY,
          2,
        )}" />`
      : "";

  return `
    <div class="chart-shell">
      <div class="chart-heading">
        <span>Requests per minute</span>
        <span>avg ${formatRpm(history.summary.averageRpm)}</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="chart" aria-label="Requests per minute chart">
        <defs>
          <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#82f9c8" />
            <stop offset="100%" stop-color="#2f6d59" />
          </linearGradient>
        </defs>
        <rect class="chart-bg" x="0" y="0" width="${width}" height="${height}" rx="14" />
        ${averageGuide}
        ${bars}
      </svg>
      <div class="chart-axis">
        <span>${history.range.label}</span>
        <span>peak ${formatRpm(history.summary.peakRpm)}</span>
      </div>
    </div>`;
}

function renderStat(label: string, value: string, hint: string): string {
  return `
    <div class="stat-tile">
      <span class="stat-label">${label}</span>
      <strong class="stat-value">${value}</strong>
      <span class="stat-hint">${hint}</span>
    </div>`;
}

function renderRangeSelector(range: ServiceMetricRange): string {
  return (["60m", "6h", "24h"] as const)
    .map((key) => {
      const option = parseServiceMetricRange(key);
      const active = option.key === range.key ? "active" : "";
      return `<a class="range-pill ${active}" href="/?range=${option.key}">${option.key}</a>`;
    })
    .join("");
}

function renderServiceCard(service: StatusServiceView): string {
  const statusColor =
    service.status === "up" ? "#82f9c8" : service.status === "degraded" ? "#f7c86a" : "#ff7b72";
  const statusLabel =
    service.status === "up" ? "UP" : service.status === "degraded" ? "DEGRADED" : "DOWN";
  const liveHint =
    service.error !== null
      ? escapeHtml(service.error)
      : `http ${service.httpStatus ?? "—"} · live ${formatDuration(service.latencyMs)}`;

  return `
    <section class="service-card ${service.status}">
      <div class="service-header">
        <div>
          <p class="service-name">${escapeHtml(service.label)}</p>
          <p class="service-url">${escapeHtml(service.url)}</p>
        </div>
        <span class="status-badge" style="--status-color:${statusColor}">${statusLabel}</span>
      </div>
      <div class="service-live">
        <span>Live probe ${formatDuration(service.latencyMs)}</span>
        <span>HTTP ${service.httpStatus ?? "—"}</span>
        <span>${liveHint}</span>
      </div>
      ${renderRequestChart(service.history)}
      <div class="stats-grid">
        ${renderStat(
          "Now rpm",
          formatRpm(service.history.summary.currentRpm),
          `avg ${formatRpm(service.history.summary.averageRpm)} · peak ${formatRpm(service.history.summary.peakRpm)}`,
        )}
        ${renderStat("Min latency", formatDuration(service.history.summary.minLatencyMs), "fastest request")}
        ${renderStat("Mean latency", formatDuration(service.history.summary.meanLatencyMs), "weighted over range")}
        ${renderStat("Max latency", formatDuration(service.history.summary.maxLatencyMs), "slowest request")}
        ${renderStat("Std dev", formatDuration(service.history.summary.stddevLatencyMs), "spread from mean")}
        ${renderStat(
          "Latest vs mean",
          formatSignedDuration(service.history.summary.latestLatencyDeltaMs),
          `latest ${formatDuration(service.history.summary.latestAvgLatencyMs)}`,
        )}
      </div>
    </section>`;
}

function getOverallPresentation(overall: DashboardPayload["overall"]): {
  label: string;
  tone: string;
} {
  if (overall === "major_outage") {
    return { label: "Major Outage", tone: "#ff7b72" };
  }

  if (overall === "partial_degradation") {
    return { label: "Partial Degradation", tone: "#f7c86a" };
  }

  return { label: "Operational", tone: "#82f9c8" };
}

function buildPlatformSummary(services: StatusServiceView[]): DashboardPayload["platform"] {
  const currentRpm = services.reduce(
    (total, service) => total + service.history.summary.currentRpm,
    0,
  );
  const totalRequests = services.reduce(
    (total, service) => total + service.history.summary.totalRequests,
    0,
  );
  const requestsByBucket = new Map<number, number>();
  for (const service of services) {
    for (const point of service.history.points) {
      requestsByBucket.set(
        point.bucketStartMs,
        (requestsByBucket.get(point.bucketStartMs) ?? 0) + point.requestCount,
      );
    }
  }
  const peakRpm = Math.max(0, ...requestsByBucket.values());
  const weightedLatency = services.reduce((total, service) => {
    const meanLatency = service.history.summary.meanLatencyMs;
    if (meanLatency === null) {
      return total;
    }

    return total + meanLatency * service.history.summary.totalRequests;
  }, 0);

  return {
    currentRpm,
    totalRequests,
    peakRpm,
    meanLatencyMs: totalRequests > 0 ? weightedLatency / totalRequests : null,
  };
}

async function loadServiceHistory(
  env: Env,
  range: ServiceMetricRange,
  now: number,
): Promise<ServiceMetricHistory[]> {
  try {
    return await Promise.all(
      SERVICES.map((service) =>
        fetchServiceMetricHistory(env.STATUS_DB, service.label, range.key, now),
      ),
    );
  } catch (error) {
    console.error("[status] failed to load history", error);
    return SERVICES.map((service) => buildServiceMetricHistory(service.label, [], range, now));
  }
}

async function buildDashboardPayload(
  env: Env,
  rangeKey?: string | null,
): Promise<DashboardPayload> {
  const now = Date.now();
  const range = parseServiceMetricRange(rangeKey);
  const [results, histories] = await Promise.all([
    probeAll(env),
    loadServiceHistory(env, range, now),
  ]);
  const snapshot = createStatusSnapshot(results);
  const historyByName = new Map(histories.map((history) => [history.serviceName, history]));
  const services = snapshot.services.map((service) => ({
    ...service,
    history:
      historyByName.get(service.label) ?? buildServiceMetricHistory(service.label, [], range, now),
  }));

  return {
    overall: snapshot.overall,
    timestamp: new Date(now).toISOString(),
    range,
    summary: snapshot.summary,
    platform: buildPlatformSummary(services),
    services,
  };
}

function renderHtml(payload: DashboardPayload): string {
  const overall = getOverallPresentation(payload.overall);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60">
<title>spike.land status</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Rubik:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#07110d;
  --bg-2:#0d1a15;
  --panel:#11211b;
  --panel-2:#132921;
  --panel-3:#0f1714;
  --border:rgba(174,228,204,.13);
  --text:#e9f8ef;
  --muted:#9ab8ab;
  --accent:#82f9c8;
  --warn:#f7c86a;
  --danger:#ff7b72;
  --shadow:0 28px 80px rgba(0,0,0,.28);
}
*{box-sizing:border-box}
html{background:
  radial-gradient(circle at top left, rgba(130,249,200,.08), transparent 28rem),
  radial-gradient(circle at top right, rgba(102,173,255,.06), transparent 26rem),
  linear-gradient(180deg, var(--bg) 0%, #050908 100%);
}
body{
  margin:0;
  min-height:100vh;
  color:var(--text);
  font-family:"Rubik",system-ui,sans-serif;
  background:transparent;
}
a{color:inherit;text-decoration:none}
.shell{max-width:1220px;margin:0 auto;padding:32px 20px 64px}
.hero{
  display:grid;
  grid-template-columns:minmax(0,1.35fr) minmax(280px,.85fr);
  gap:18px;
  margin-bottom:18px;
}
.hero-panel,
.overview-card,
.service-card{
  background:linear-gradient(180deg, rgba(17,33,27,.96), rgba(12,24,20,.96));
  border:1px solid var(--border);
  border-radius:22px;
  box-shadow:var(--shadow);
}
.hero-panel{
  padding:28px 28px 24px;
  position:relative;
  overflow:hidden;
}
.hero-panel::before{
  content:"";
  position:absolute;
  inset:auto -30% 55% auto;
  width:280px;
  height:280px;
  border-radius:999px;
  background:radial-gradient(circle, rgba(130,249,200,.18), transparent 70%);
  pointer-events:none;
}
.eyebrow{
  margin:0 0 10px;
  color:#b6dccc;
  letter-spacing:.18em;
  text-transform:uppercase;
  font-size:.72rem;
  font-weight:700;
}
h1{
  margin:0;
  font-size:clamp(2.1rem,4.2vw,4rem);
  line-height:.96;
  letter-spacing:-.04em;
}
.hero-copy{
  margin:14px 0 0;
  max-width:44rem;
  color:var(--muted);
  font-size:1rem;
  line-height:1.55;
}
.hero-rail{
  display:grid;
  gap:14px;
  padding:24px;
}
.hero-rail .status-pill{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  padding:12px 16px;
  border-radius:999px;
  background:rgba(233,248,239,.06);
  border:1px solid rgba(233,248,239,.08);
  color:#f6fffb;
  font-weight:700;
}
.hero-rail .status-pill::before{
  content:"";
  width:10px;
  height:10px;
  border-radius:999px;
  background:var(--tone);
  box-shadow:0 0 18px var(--tone);
}
.range-row{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}
.range-pill{
  padding:10px 14px;
  border-radius:999px;
  border:1px solid rgba(233,248,239,.08);
  color:var(--muted);
  font-size:.86rem;
  background:rgba(255,255,255,.02);
}
.range-pill.active{
  background:rgba(130,249,200,.12);
  color:#f6fffb;
  border-color:rgba(130,249,200,.3);
}
.range-copy{
  color:var(--muted);
  font-size:.9rem;
  line-height:1.5;
}
.overview-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:14px;
  margin-bottom:18px;
}
.overview-card{
  padding:18px 20px;
}
.overview-label{
  display:block;
  color:var(--muted);
  font-size:.78rem;
  letter-spacing:.12em;
  text-transform:uppercase;
  margin-bottom:10px;
}
.overview-value{
  display:block;
  font-size:1.8rem;
  font-weight:700;
  letter-spacing:-.04em;
}
.overview-hint{
  display:block;
  margin-top:6px;
  color:var(--muted);
  font-size:.88rem;
}
.services-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(340px,1fr));
  gap:16px;
}
.service-card{
  padding:20px;
  display:grid;
  gap:14px;
  border-color:rgba(174,228,204,.13);
}
.service-card.degraded{border-color:rgba(247,200,106,.3)}
.service-card.down{border-color:rgba(255,123,114,.34)}
.service-header{
  display:flex;
  justify-content:space-between;
  gap:16px;
  align-items:flex-start;
}
.service-name{
  margin:0;
  font-size:1.18rem;
  font-weight:700;
  letter-spacing:-.02em;
}
.service-url{
  margin:6px 0 0;
  color:var(--muted);
  font-family:"JetBrains Mono",monospace;
  font-size:.74rem;
  line-height:1.45;
  word-break:break-word;
}
.status-badge{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:8px 11px;
  border-radius:999px;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.08);
  color:#f8fffb;
  font-size:.73rem;
  font-weight:700;
  letter-spacing:.12em;
}
.status-badge::before{
  content:"";
  width:8px;
  height:8px;
  border-radius:999px;
  background:var(--status-color);
  box-shadow:0 0 14px var(--status-color);
}
.service-live{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  color:var(--muted);
  font-size:.82rem;
}
.service-live span{
  padding:8px 10px;
  border-radius:999px;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.06);
}
.chart-shell{
  padding:14px;
  border-radius:18px;
  background:linear-gradient(180deg, rgba(8,16,13,.9), rgba(11,23,19,.92));
  border:1px solid rgba(255,255,255,.05);
}
.chart-heading,
.chart-axis{
  display:flex;
  justify-content:space-between;
  gap:12px;
  color:var(--muted);
  font-size:.8rem;
}
.chart-heading{margin-bottom:10px}
.chart-axis{margin-top:10px}
.chart{
  width:100%;
  height:auto;
  display:block;
}
.chart-bg{
  fill:rgba(255,255,255,.015);
  stroke:rgba(255,255,255,.04);
}
.chart-average{
  stroke:rgba(247,200,106,.8);
  stroke-width:1.4;
  stroke-dasharray:4 4;
}
.chart-bar{
  fill:var(--chart-fill);
  opacity:.7;
}
.chart-bar.latest{
  opacity:1;
  fill:#e9f8ef;
}
.stats-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
}
.stat-tile{
  padding:13px 14px;
  border-radius:16px;
  background:rgba(255,255,255,.028);
  border:1px solid rgba(255,255,255,.05);
}
.stat-label{
  display:block;
  color:var(--muted);
  font-size:.76rem;
  letter-spacing:.08em;
  text-transform:uppercase;
}
.stat-value{
  display:block;
  margin:7px 0 4px;
  font-size:1.12rem;
  font-weight:700;
  letter-spacing:-.03em;
}
.stat-hint{
  display:block;
  color:var(--muted);
  font-size:.8rem;
  line-height:1.45;
}
.footer{
  margin-top:18px;
  color:var(--muted);
  font-size:.82rem;
  display:flex;
  flex-wrap:wrap;
  justify-content:space-between;
  gap:12px;
}
.footer a{
  color:#d6f6e6;
  text-decoration:underline;
}
@media (max-width: 980px){
  .hero{grid-template-columns:1fr}
  .overview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width: 720px){
  .shell{padding:18px 14px 44px}
  .hero-panel,.hero-rail,.overview-card,.service-card{border-radius:18px}
  .overview-grid{grid-template-columns:1fr}
  .stats-grid{grid-template-columns:1fr}
  .service-header{flex-direction:column}
}
</style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div class="hero-panel">
        <p class="eyebrow">spike.land / status</p>
        <h1>Historical Service Telemetry</h1>
        <p class="hero-copy">Per-service requests per minute, live health probes, and latency spread over ${escapeHtml(
          payload.range.label.toLowerCase(),
        )}. Status probes are excluded from the historical charts so the traffic view stays operationally useful.</p>
      </div>
      <div class="hero-panel hero-rail" style="--tone:${overall.tone}">
        <div class="status-pill">${overall.label}</div>
        <div class="range-row">${renderRangeSelector(payload.range)}</div>
        <p class="range-copy">Window selector changes the per-service history below without changing the live probe cadence. The page refreshes every 60 seconds.</p>
      </div>
    </section>

    <section class="overview-grid">
      <div class="overview-card">
        <span class="overview-label">Service State</span>
        <strong class="overview-value">${payload.summary.up}/${payload.summary.total}</strong>
        <span class="overview-hint">${payload.summary.degraded} degraded · ${payload.summary.down} down</span>
      </div>
      <div class="overview-card">
        <span class="overview-label">Live Platform Rpm</span>
        <strong class="overview-value">${formatRpm(payload.platform.currentRpm)}</strong>
        <span class="overview-hint">current minute across tracked services</span>
      </div>
      <div class="overview-card">
        <span class="overview-label">Observed Requests</span>
        <strong class="overview-value">${payload.platform.totalRequests.toLocaleString()}</strong>
        <span class="overview-hint">${escapeHtml(payload.range.label.toLowerCase())}</span>
      </div>
      <div class="overview-card">
        <span class="overview-label">Mean Latency</span>
        <strong class="overview-value">${formatDuration(payload.platform.meanLatencyMs)}</strong>
        <span class="overview-hint">peak combined load ${formatRpm(payload.platform.peakRpm)}</span>
      </div>
    </section>

    <section class="services-grid">
      ${payload.services.map(renderServiceCard).join("\n")}
    </section>

    <footer class="footer">
      <span>Last checked ${escapeHtml(payload.timestamp)} · Timeout ${TIMEOUT_MS}ms · Degraded threshold ${DEGRADED_THRESHOLD_MS}ms</span>
      <span><a href="/api/status?range=${payload.range.key}">JSON API</a></span>
    </footer>
  </main>
</body>
</html>`;
}

// Own health
app.get("/health", (c) => c.json({ status: "ok", service: "spike-status" }));

// JSON API
app.get("/api/status", async (c) => {
  const payload = await buildDashboardPayload(c.env, c.req.query("range"));
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET");
  c.header("Cache-Control", "public, max-age=60");
  return c.json(payload);
});

// HTML status page
app.get("/", async (c) => {
  const payload = await buildDashboardPayload(c.env, c.req.query("range"));
  return c.html(renderHtml(payload));
});

export default app;

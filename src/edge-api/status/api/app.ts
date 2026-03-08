import { Hono } from "hono";
import type { Env } from "../core-logic/env.ts";
import {
  createStatusSnapshot,
  DEGRADED_THRESHOLD_MS,
  probeAll,
  TIMEOUT_MS,
} from "../core-logic/monitor.ts";

const app = new Hono<{ Bindings: Env }>();

// Own health
app.get("/health", (c) =>
  c.json({ status: "ok", service: "spike-status" }),
);

// JSON API
app.get("/api/status", async (c) => {
  const results = await probeAll(c.env);
  const snapshot = createStatusSnapshot(results);

  return c.json({
    overall: snapshot.overall,
    timestamp: new Date().toISOString(),
    summary: snapshot.summary,
    services: snapshot.services,
  });
});

// HTML status page
app.get("/", async (c) => {
  const results = await probeAll(c.env);
  const snapshot = createStatusSnapshot(results);

  let overall = "Operational";
  let overallColor = "#22c55e";
  if (snapshot.overall === "major_outage") {
    overall = "Major Outage";
    overallColor = "#ef4444";
  } else if (snapshot.overall === "partial_degradation") {
    overall = "Partial Degradation";
    overallColor = "#f59e0b";
  }

  const statusColor = (s: string) =>
    s === "up" ? "#22c55e" : s === "degraded" ? "#f59e0b" : "#ef4444";
  const statusLabel = (s: string) =>
    s === "up" ? "UP" : s === "degraded" ? "DEGRADED" : "DOWN";

  const serviceCards = results
    .map(
      (r) => `
      <div class="card">
        <div class="card-header">
          <span class="service-name">${r.label}</span>
          <span class="badge" style="background:${statusColor(r.status)}">${statusLabel(r.status)}</span>
        </div>
        <div class="card-details">
          <span class="latency">${r.latencyMs}ms</span>
          <span class="http-status">${r.httpStatus ?? "—"}</span>
          ${r.error ? `<span class="error">${r.error}</span>` : ""}
        </div>
      </div>`,
    )
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>spike.land status</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;background:#0a0a0a;color:#e5e5e5;min-height:100vh;padding:2rem}
.container{max-width:720px;margin:0 auto}
h1{font-size:1.5rem;font-weight:600;margin-bottom:.25rem}
.subtitle{color:#737373;font-size:.85rem;margin-bottom:1.5rem}
.overall{display:inline-block;padding:.35rem .75rem;border-radius:6px;font-weight:600;font-size:.9rem;color:#0a0a0a;margin-bottom:1.5rem}
.summary{display:flex;gap:1.5rem;margin-bottom:1.5rem;font-size:.85rem}
.summary span{display:flex;align-items:center;gap:.35rem}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}
.card{background:#171717;border:1px solid #262626;border-radius:8px;padding:.85rem 1rem;margin-bottom:.5rem}
.card-header{display:flex;justify-content:space-between;align-items:center}
.service-name{font-weight:500;font-size:.9rem}
.badge{padding:.15rem .5rem;border-radius:4px;font-size:.7rem;font-weight:700;color:#0a0a0a;letter-spacing:.03em}
.card-details{margin-top:.4rem;display:flex;gap:1rem;font-size:.75rem;color:#737373}
.error{color:#ef4444}
.footer{margin-top:2rem;font-size:.75rem;color:#525252;border-top:1px solid #262626;padding-top:1rem}
.footer a{color:#737373;text-decoration:underline}
</style>
</head>
<body>
<div class="container">
  <h1>Live Platform Telemetry</h1>
  <p class="subtitle">spike.land status</p>
  <div class="overall" style="background:${overallColor}">${overall}</div>
  <div class="summary">
    <span><span class="dot" style="background:#22c55e"></span> ${snapshot.summary.up} Up</span>
    <span><span class="dot" style="background:#f59e0b"></span> ${snapshot.summary.degraded} Degraded</span>
    <span><span class="dot" style="background:#ef4444"></span> ${snapshot.summary.down} Down</span>
  </div>
  ${serviceCards}
  <div class="footer">
    <p>Last checked: ${new Date().toISOString()} · Timeout: ${TIMEOUT_MS}ms · Degraded threshold: ${DEGRADED_THRESHOLD_MS}ms</p>
    <p><a href="/api/status">JSON API</a> · Auto-refreshes every 30s</p>
  </div>
</div>
</body>
</html>`;

  return c.html(html);
});

export default app;

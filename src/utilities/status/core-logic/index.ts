interface ServiceConfig {
  name: string;
  url: string;
  expectedStatus?: number[];
}

interface ServiceCheck extends ServiceConfig {
  status: "up" | "degraded" | "down";
  responseTime: number;
  statusCode?: number;
  error?: string;
}

const SERVICES: ServiceConfig[] = [
  {
    name: "Main Site",
    url: "https://spike-edge.spikeland.workers.dev/health",
    expectedStatus: [200],
  },
  { name: "Edge API", url: "https://api.spike.land/health", expectedStatus: [200] },
  { name: "Transpile", url: "https://js.spike.land/health", expectedStatus: [200] },
  { name: "ESM CDN", url: "https://esm.spike.land/health", expectedStatus: [200] },
  {
    name: "MCP Registry",
    url: "https://spike-land-mcp.spikeland.workers.dev/health",
    expectedStatus: [200],
  },
  { name: "Auth MCP", url: "https://auth-mcp.spike.land/health", expectedStatus: [200] },
];

const TIMEOUT_MS = 3000;
const DEGRADED_MS = 1200;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function checkService(service: ServiceConfig): Promise<ServiceCheck> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(service.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "spike-status/1.1",
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    const responseTime = Date.now() - start;
    const expected = service.expectedStatus ?? [200];

    if (!expected.includes(res.status)) {
      return {
        ...service,
        status: "down",
        responseTime,
        statusCode: res.status,
        error: `HTTP ${res.status}`,
      };
    }

    return {
      ...service,
      status: responseTime > DEGRADED_MS ? "degraded" : "up",
      responseTime,
      statusCode: res.status,
    };
  } catch (err) {
    return {
      ...service,
      status: "down",
      responseTime: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkAll(): Promise<ServiceCheck[]> {
  const results = await Promise.allSettled(SERVICES.map(checkService));
  return results.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : {
          ...SERVICES[index],
          status: "down" as const,
          responseTime: TIMEOUT_MS,
          error: "Check failed",
        },
  );
}

function overallStatus(checks: ServiceCheck[]): "ok" | "degraded" | "down" {
  const downCount = checks.filter((check) => check.status === "down").length;
  if (downCount === checks.length) return "down";
  if (downCount > 0 || checks.some((check) => check.status === "degraded")) return "degraded";
  return "ok";
}

function getCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
  };
}

function renderHTML(checks: ServiceCheck[], overall: "ok" | "degraded" | "down"): string {
  const totals = {
    up: checks.filter((check) => check.status === "up").length,
    degraded: checks.filter((check) => check.status === "degraded").length,
    down: checks.filter((check) => check.status === "down").length,
  };
  const checkedAt = new Date().toISOString();
  const bannerText = {
    ok: "All Systems Operational",
    degraded: "Partial Degradation",
    down: "Major Outage",
  }[overall];
  const bannerTone = {
    ok: "linear-gradient(135deg, #15803d 0%, #22c55e 100%)",
    degraded: "linear-gradient(135deg, #a16207 0%, #f59e0b 100%)",
    down: "linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)",
  }[overall];
  const dotColor = { up: "#22c55e", degraded: "#f59e0b", down: "#ef4444" };

  const rows = checks
    .map((check) => {
      const meta = check.error
        ? `${check.responseTime}ms · ${escapeHtml(check.error)}`
        : `${check.responseTime}ms · HTTP ${check.statusCode ?? 200}`;
      return `
        <article class="service-card">
          <div class="service-main">
            <div class="service-heading">
              <span class="dot" style="background:${dotColor[check.status]}"></span>
              <div>
                <h2>${escapeHtml(check.name)}</h2>
                <p>${escapeHtml(meta)}</p>
              </div>
            </div>
            <span class="badge ${check.status}">${check.status.toUpperCase()}</span>
          </div>
          <div class="service-footer">
            <code>${escapeHtml(check.url)}</code>
          </div>
        </article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>spike.land Status</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --bg: #eef2ff;
      --bg-2: #f8fafc;
      --surface: rgba(255,255,255,0.82);
      --surface-strong: rgba(255,255,255,0.94);
      --border: rgba(15,23,42,0.08);
      --text: #0f172a;
      --muted: #475569;
      --shadow: 0 20px 60px rgba(37, 99, 235, 0.12);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #060816;
        --bg-2: #0b1023;
        --surface: rgba(11,16,35,0.72);
        --surface-strong: rgba(15,23,42,0.92);
        --border: rgba(148,163,184,0.16);
        --text: #e2e8f0;
        --muted: #94a3b8;
        --shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
      }
    }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Rubik", ui-sans-serif, system-ui, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(96, 165, 250, 0.22), transparent 30%),
        radial-gradient(circle at top right, rgba(34, 197, 94, 0.18), transparent 24%),
        linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%);
    }
    .shell {
      width: min(1040px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 40px 0 64px;
    }
    .hero {
      display: grid;
      gap: 24px;
      margin-bottom: 24px;
    }
    .hero-card {
      background: var(--surface);
      backdrop-filter: blur(18px);
      border: 1px solid var(--border);
      border-radius: 28px;
      box-shadow: var(--shadow);
      padding: 28px;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface-strong);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
    }
    h1 {
      margin: 18px 0 8px;
      font-size: clamp(40px, 7vw, 76px);
      line-height: 0.95;
      letter-spacing: -0.06em;
    }
    .hero p {
      max-width: 720px;
      font-size: 18px;
      line-height: 1.7;
      color: var(--muted);
      margin: 0;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-top: 22px;
    }
    .summary-card {
      border-radius: 20px;
      border: 1px solid var(--border);
      background: var(--surface-strong);
      padding: 16px;
    }
    .summary-card strong {
      display: block;
      font-size: 28px;
      line-height: 1;
      margin-top: 8px;
    }
    .summary-card span {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      background: ${bannerTone};
      color: white;
      border-radius: 24px;
      padding: 18px 22px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }
    .banner strong {
      display: block;
      font-size: 20px;
    }
    .banner small {
      display: block;
      opacity: 0.9;
      margin-top: 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .service-card {
      background: var(--surface);
      backdrop-filter: blur(18px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 18px;
      box-shadow: var(--shadow);
    }
    .service-main {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .service-heading {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .service-heading h2 {
      margin: 0;
      font-size: 19px;
      line-height: 1.1;
    }
    .service-heading p {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 14px;
    }
    .service-footer {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }
    code {
      font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
      font-size: 12px;
      color: var(--muted);
      word-break: break-all;
    }
    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-top: 4px;
      flex-shrink: 0;
      box-shadow: 0 0 18px currentColor;
    }
    .badge {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .badge.up { background: rgba(34, 197, 94, 0.12); color: #22c55e; border-color: rgba(34, 197, 94, 0.22); }
    .badge.degraded { background: rgba(245, 158, 11, 0.12); color: #f59e0b; border-color: rgba(245, 158, 11, 0.24); }
    .badge.down { background: rgba(239, 68, 68, 0.12); color: #ef4444; border-color: rgba(239, 68, 68, 0.24); }
    .footer {
      text-align: center;
      margin-top: 18px;
      color: var(--muted);
      font-size: 13px;
    }
    .footer a { color: inherit; }
    @media (max-width: 820px) {
      .summary, .grid { grid-template-columns: 1fr; }
      .banner { flex-direction: column; align-items: flex-start; }
      .service-main { flex-direction: column; }
      .shell { width: min(1040px, calc(100vw - 20px)); padding-top: 20px; }
      .hero-card { padding: 22px; border-radius: 22px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero hero-card">
      <div class="eyebrow">Live Platform Telemetry</div>
      <div>
        <h1>spike.land status</h1>
        <p>Real-time health checks for the main product surface and the edge services behind it. This page refreshes every 30 seconds and probes each service directly.</p>
      </div>
      <div class="summary">
        <div class="summary-card"><span>Overall</span><strong>${escapeHtml(bannerText)}</strong></div>
        <div class="summary-card"><span>Up</span><strong>${totals.up}</strong></div>
        <div class="summary-card"><span>Degraded</span><strong>${totals.degraded}</strong></div>
        <div class="summary-card"><span>Down</span><strong>${totals.down}</strong></div>
      </div>
    </section>

    <section class="banner">
      <div>
        <strong>${escapeHtml(bannerText)}</strong>
        <small>Checked at ${escapeHtml(checkedAt)}</small>
      </div>
      <small>Timeout ${TIMEOUT_MS}ms · degraded threshold ${DEGRADED_MS}ms</small>
    </section>

    <section class="grid">${rows}</section>

    <div class="footer">Auto-refreshes every 30 seconds · JSON: <a href="/api/status">/api/status</a></div>
  </main>
</body>
</html>`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const cors = getCorsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/health") {
      const checks = await checkAll();
      const overall = overallStatus(checks);
      return Response.json(
        { status: overall, timestamp: new Date().toISOString() },
        { headers: { "Cache-Control": "no-cache", ...cors } },
      );
    }

    if (url.pathname === "/api/status") {
      const checks = await checkAll();
      const overall = overallStatus(checks);
      return Response.json(
        { status: overall, services: checks, timestamp: new Date().toISOString() },
        { headers: { "Cache-Control": "no-cache", ...cors } },
      );
    }

    if (url.pathname === "/" || url.pathname === "") {
      const checks = await checkAll();
      const overall = overallStatus(checks);
      return new Response(renderHTML(checks, overall), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          ...cors,
        },
      });
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: cors });
  },
};

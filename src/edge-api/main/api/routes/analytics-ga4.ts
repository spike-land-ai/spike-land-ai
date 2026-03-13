import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import {
  runGA4Report,
  batchRunGA4Reports,
  runGA4RealtimeReport,
} from "../../core-logic/ga4-client.js";
import { getCachedResponse, setCachedResponse } from "../../core-logic/ga4-cache.js";
import { requireInternalSecret } from "../../core-logic/internal-auth.js";

const analyticsGa4 = new Hono<{ Bindings: Env; Variables: Variables }>();

const ADMIN_EMAILS = new Set(["zoltan.erdos@spike.land", "zolika84@gmail.com"]);

async function requireFounderOrSecret(
  c: import("hono").Context<{ Bindings: Env; Variables: Variables }>,
): Promise<{ authorized: boolean; error?: string; status?: number }> {
  if (requireInternalSecret(c.env, c.req)) {
    return { authorized: true };
  }
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }
  const email = c.get("userEmail") as string | undefined;
  if (!email || !ADMIN_EMAILS.has(email)) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }
  return { authorized: true };
}

type TimeRange =
  | "1m"
  | "5m"
  | "15m"
  | "1h"
  | "6h"
  | "24h"
  | "7d"
  | "30d"
  | "3mo"
  | "6mo"
  | "1y"
  | "3y";

const VALID_RANGES = new Set<string>([
  "1m",
  "5m",
  "15m",
  "1h",
  "6h",
  "24h",
  "7d",
  "30d",
  "3mo",
  "6mo",
  "1y",
  "3y",
]);

const REALTIME_RANGES = new Set<string>(["1m", "5m", "15m"]);

function rangeToGA4Dates(range: TimeRange): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = "today";

  switch (range) {
    case "1h":
    case "6h":
    case "24h":
      return { startDate: "today", endDate };
    case "7d":
      return { startDate: "7daysAgo", endDate };
    case "30d":
      return { startDate: "30daysAgo", endDate };
    case "3mo": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { startDate: d.toISOString().slice(0, 10), endDate };
    }
    case "6mo": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return { startDate: d.toISOString().slice(0, 10), endDate };
    }
    case "1y": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return { startDate: d.toISOString().slice(0, 10), endDate };
    }
    case "3y": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 3);
      return { startDate: d.toISOString().slice(0, 10), endDate };
    }
    default:
      return { startDate: "30daysAgo", endDate };
  }
}

// GET /analytics/ga4/overview?range=
analyticsGa4.get("/analytics/ga4/overview", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) return c.json({ error: auth.error }, auth.status as 401 | 403);

  const range = (c.req.query("range") ?? "24h") as TimeRange;
  if (!VALID_RANGES.has(range)) return c.json({ error: "Invalid range" }, 400);

  const cached = getCachedResponse<unknown>("overview", range);
  if (cached) return c.json(cached);

  if (REALTIME_RANGES.has(range)) {
    const report = await runGA4RealtimeReport(c.env, {
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      dimensions: [{ name: "unifiedScreenName" }],
      limit: 20,
    });

    const totalActiveUsers =
      report.rows?.reduce(
        (sum, row) => sum + parseInt(row.metricValues?.[0]?.value ?? "0", 10),
        0,
      ) ?? 0;

    const result = { activeUsers: totalActiveUsers, topPages: report.rows ?? [], isRealtime: true };
    setCachedResponse("overview", range, result);
    return c.json(result);
  }

  const dates = rangeToGA4Dates(range);
  const reports = await batchRunGA4Reports(c.env, [
    {
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
        { name: "engagementRate" },
      ],
      dateRanges: [dates],
    },
    {
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      dateRanges: [dates],
      orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
      limit: 365,
    },
  ]);

  const totals = reports[0]?.rows?.[0];
  const timeSeries = reports[1]?.rows ?? [];

  const result = {
    sessions: parseInt(totals?.metricValues?.[0]?.value ?? "0", 10),
    activeUsers: parseInt(totals?.metricValues?.[1]?.value ?? "0", 10),
    pageViews: parseInt(totals?.metricValues?.[2]?.value ?? "0", 10),
    avgSessionDuration: parseFloat(totals?.metricValues?.[3]?.value ?? "0"),
    bounceRate: parseFloat(totals?.metricValues?.[4]?.value ?? "0"),
    engagementRate: parseFloat(totals?.metricValues?.[5]?.value ?? "0"),
    timeSeries: timeSeries.map((row) => ({
      date: row.dimensionValues?.[0]?.value ?? "",
      sessions: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      users: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
    })),
    isRealtime: false,
  };

  setCachedResponse("overview", range, result);
  return c.json(result);
});

// GET /analytics/ga4/acquisition?range=
analyticsGa4.get("/analytics/ga4/acquisition", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) return c.json({ error: auth.error }, auth.status as 401 | 403);

  const range = (c.req.query("range") ?? "24h") as TimeRange;
  if (!VALID_RANGES.has(range)) return c.json({ error: "Invalid range" }, 400);
  if (REALTIME_RANGES.has(range)) return c.json({ channels: [], sources: [], landingPages: [] });

  const cached = getCachedResponse<unknown>("acquisition", range);
  if (cached) return c.json(cached);

  const dates = rangeToGA4Dates(range);
  const reports = await batchRunGA4Reports(c.env, [
    {
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    },
    {
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "sessions" }, { name: "bounceRate" }],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 20,
    },
    {
      dimensions: [{ name: "landingPage" }],
      metrics: [{ name: "sessions" }],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    },
  ]);

  const result = {
    channels: (reports[0]?.rows ?? []).map((row) => ({
      channel: row.dimensionValues?.[0]?.value ?? "",
      sessions: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      users: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
    })),
    sources: (reports[1]?.rows ?? []).map((row) => ({
      source: row.dimensionValues?.[0]?.value ?? "",
      medium: row.dimensionValues?.[1]?.value ?? "",
      sessions: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      bounceRate: parseFloat(row.metricValues?.[1]?.value ?? "0"),
    })),
    landingPages: (reports[2]?.rows ?? []).map((row) => ({
      page: row.dimensionValues?.[0]?.value ?? "",
      sessions: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    })),
  };

  setCachedResponse("acquisition", range, result);
  return c.json(result);
});

// GET /analytics/ga4/content?range=
analyticsGa4.get("/analytics/ga4/content", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) return c.json({ error: auth.error }, auth.status as 401 | 403);

  const range = (c.req.query("range") ?? "24h") as TimeRange;
  if (!VALID_RANGES.has(range)) return c.json({ error: "Invalid range" }, 400);
  if (REALTIME_RANGES.has(range)) return c.json({ pages: [], engagement: null });

  const cached = getCachedResponse<unknown>("content", range);
  if (cached) return c.json(cached);

  const dates = rangeToGA4Dates(range);
  const reports = await batchRunGA4Reports(c.env, [
    {
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 20,
    },
    {
      metrics: [
        { name: "screenPageViewsPerSession" },
        { name: "engagementRate" },
        { name: "averageSessionDuration" },
      ],
      dateRanges: [dates],
    },
  ]);

  const engagementRow = reports[1]?.rows?.[0];

  const result = {
    pages: (reports[0]?.rows ?? []).map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? "",
      views: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      avgDuration: parseFloat(row.metricValues?.[1]?.value ?? "0"),
      bounceRate: parseFloat(row.metricValues?.[2]?.value ?? "0"),
    })),
    engagement: engagementRow
      ? {
          pagesPerSession: parseFloat(engagementRow.metricValues?.[0]?.value ?? "0"),
          engagementRate: parseFloat(engagementRow.metricValues?.[1]?.value ?? "0"),
          avgSessionDuration: parseFloat(engagementRow.metricValues?.[2]?.value ?? "0"),
        }
      : null,
  };

  setCachedResponse("content", range, result);
  return c.json(result);
});

// GET /analytics/ga4/geo?range=
analyticsGa4.get("/analytics/ga4/geo", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) return c.json({ error: auth.error }, auth.status as 401 | 403);

  const range = (c.req.query("range") ?? "24h") as TimeRange;
  if (!VALID_RANGES.has(range)) return c.json({ error: "Invalid range" }, 400);
  if (REALTIME_RANGES.has(range)) return c.json({ countries: [], cities: [], languages: [] });

  const cached = getCachedResponse<unknown>("geo", range);
  if (cached) return c.json(cached);

  const dates = rangeToGA4Dates(range);
  const reports = await batchRunGA4Reports(c.env, [
    {
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 20,
    },
    {
      dimensions: [{ name: "city" }],
      metrics: [{ name: "activeUsers" }],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    },
    {
      dimensions: [{ name: "language" }],
      metrics: [{ name: "activeUsers" }],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    },
  ]);

  const result = {
    countries: (reports[0]?.rows ?? []).map((row) => ({
      country: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      sessions: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
    })),
    cities: (reports[1]?.rows ?? []).map((row) => ({
      city: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    })),
    languages: (reports[2]?.rows ?? []).map((row) => ({
      language: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    })),
  };

  setCachedResponse("geo", range, result);
  return c.json(result);
});

// GET /analytics/ga4/devices?range=
analyticsGa4.get("/analytics/ga4/devices", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) return c.json({ error: auth.error }, auth.status as 401 | 403);

  const range = (c.req.query("range") ?? "24h") as TimeRange;
  if (!VALID_RANGES.has(range)) return c.json({ error: "Invalid range" }, 400);
  if (REALTIME_RANGES.has(range)) return c.json({ categories: [], browsers: [], os: [] });

  const cached = getCachedResponse<unknown>("devices", range);
  if (cached) return c.json(cached);

  const dates = rangeToGA4Dates(range);
  const reports = await batchRunGA4Reports(c.env, [
    {
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }, { name: "sessions" }],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    },
    {
      dimensions: [{ name: "browser" }],
      metrics: [{ name: "activeUsers" }],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    },
    {
      dimensions: [{ name: "operatingSystem" }],
      metrics: [{ name: "activeUsers" }],
      dateRanges: [dates],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    },
  ]);

  const result = {
    categories: (reports[0]?.rows ?? []).map((row) => ({
      category: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      sessions: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
    })),
    browsers: (reports[1]?.rows ?? []).map((row) => ({
      browser: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    })),
    os: (reports[2]?.rows ?? []).map((row) => ({
      os: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    })),
  };

  setCachedResponse("devices", range, result);
  return c.json(result);
});

// GET /analytics/ga4/retention?range=
analyticsGa4.get("/analytics/ga4/retention", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) return c.json({ error: auth.error }, auth.status as 401 | 403);

  const range = (c.req.query("range") ?? "24h") as TimeRange;
  if (!VALID_RANGES.has(range)) return c.json({ error: "Invalid range" }, 400);
  if (REALTIME_RANGES.has(range)) return c.json({ newVsReturning: [] });

  const cached = getCachedResponse<unknown>("retention", range);
  if (cached) return c.json(cached);

  const dates = rangeToGA4Dates(range);
  const report = await runGA4Report(c.env, {
    dimensions: [{ name: "newVsReturning" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }],
    dateRanges: [dates],
  });

  const result = {
    newVsReturning: (report.rows ?? []).map((row) => ({
      type: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
      sessions: parseInt(row.metricValues?.[1]?.value ?? "0", 10),
    })),
  };

  setCachedResponse("retention", range, result);
  return c.json(result);
});

// GET /analytics/ga4/realtime
analyticsGa4.get("/analytics/ga4/realtime", async (c) => {
  const auth = await requireFounderOrSecret(c);
  if (!auth.authorized) return c.json({ error: auth.error }, auth.status as 401 | 403);

  const cached = getCachedResponse<unknown>("realtime", "realtime");
  if (cached) return c.json(cached);

  const [byPage, byCountry, byDevice] = await Promise.all([
    runGA4RealtimeReport(c.env, {
      dimensions: [{ name: "unifiedScreenName" }],
      metrics: [{ name: "activeUsers" }],
      limit: 10,
    }),
    runGA4RealtimeReport(c.env, {
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }],
      limit: 10,
    }),
    runGA4RealtimeReport(c.env, {
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }],
    }),
  ]);

  const totalActive =
    byPage.rows?.reduce((sum, row) => sum + parseInt(row.metricValues?.[0]?.value ?? "0", 10), 0) ??
    0;

  const result = {
    activeUsers: totalActive,
    topPages: (byPage.rows ?? []).map((row) => ({
      page: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    })),
    topCountries: (byCountry.rows ?? []).map((row) => ({
      country: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    })),
    devices: (byDevice.rows ?? []).map((row) => ({
      category: row.dimensionValues?.[0]?.value ?? "",
      users: parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    })),
  };

  setCachedResponse("realtime", "realtime", result);
  return c.json(result);
});

export { analyticsGa4 };

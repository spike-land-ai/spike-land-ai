# Growth Metrics & Analytics Infrastructure

> Last updated: 2026-03-05

## What We Track Today

### spike-edge (D1: `spike-edge-db`)

| Table | What it captures | Key columns |
|-------|-----------------|-------------|
| `analytics_events` | Frontend/API events forwarded from SPA | `source`, `eventType`, `metadata` (JSON), `created_at` |
| `error_logs` | Server-side errors with context | `route`, `status`, `message`, `stack`, `created_at` |
| `credit_ledger` | Credit transactions (purchases, usage, refunds) | `user_id`, `amount`, `type`, `created_at` |

### spike-land-mcp (D1: `spike-land-mcp-db`)

| Table | What it captures | Key columns |
|-------|-----------------|-------------|
| `tool_call_daily` | Daily rollup of MCP tool invocations | `tool_name`, `server_name`, `day`, `call_count`, `error_count`, `total_ms` |
| `tool_user_daily` | Per-user daily tool usage | `tool_name`, `user_id`, `day`, `call_count` |
| `skill_usage_events` | Skill install/uninstall/usage events | `skill_id`, `user_id`, `event_type`, `created_at` |
| `experiments` | A/B test definitions and variants | `id`, `name`, `variants`, `status` |
| `experiment_events` | A/B test participation and conversion events | `experiment_id`, `variant`, `event_type` |

### mcp-auth (D1: `mcp-auth-db`)

| Table | What it captures | Key columns |
|-------|-----------------|-------------|
| `users` | Registered users | `id`, `email`, `role`, `created_at` |
| `api_keys` | API key usage tracking | `user_id`, `last_used_at` |

## GA4 Integration

Analytics events from spike-edge are forwarded to Google Analytics 4 via the
Measurement Protocol. The integration lives in `src/spike-edge/lib/ga4.ts`.

Events forwarded: page views, tool calls, sign-ups, purchases.

## Internal Analytics API

### spike-land-mcp: `/internal/analytics/*`

Called by spike-edge via service binding. Queries rollup tables for fast
aggregations.

| Endpoint | Returns |
|----------|---------|
| `GET /internal/analytics/tools?range=7d&limit=20` | Top tools by call count |
| `GET /internal/analytics/users?range=7d` | Active users by tool usage |

### spike-edge: `GET /api/analytics/events?range=7d`

Returns aggregated analytics events. Supports `24h`, `7d`, `30d` ranges.

## Key Queries

### Total registered users

```sql
-- mcp-auth D1
SELECT COUNT(*) FROM users;
```

### Daily active users (DAU)

```sql
-- spike-land-mcp D1
SELECT COUNT(DISTINCT user_id) FROM tool_user_daily
WHERE day >= strftime('%s', 'now', '-1 day') * 1000;
```

### Monthly active users (MAU)

```sql
SELECT COUNT(DISTINCT user_id) FROM tool_user_daily
WHERE day >= strftime('%s', 'now', '-30 days') * 1000;
```

### Top tools (7-day)

```sql
SELECT tool_name, SUM(call_count) as total
FROM tool_call_daily
WHERE day >= strftime('%s', 'now', '-7 days') * 1000
GROUP BY tool_name
ORDER BY total DESC
LIMIT 20;
```

### Error rate

```sql
-- spike-edge D1
SELECT
  COUNT(*) as total_errors,
  COUNT(DISTINCT route) as affected_routes
FROM error_logs
WHERE created_at >= strftime('%s', 'now', '-24 hours') * 1000;
```

### MRR (Monthly Recurring Revenue)

```sql
-- spike-edge D1 (credit_ledger)
SELECT SUM(amount) FROM credit_ledger
WHERE type = 'purchase'
  AND created_at >= strftime('%s', 'now', '-30 days') * 1000;
```

## Cockpit Dashboard

A partially wired dashboard exists at `GET /api/cockpit/metrics` in spike-edge.
It returns:

```json
{
  "userCount": 0,
  "activeSubscriptions": 0,
  "toolCount": 80,
  "mrr": 0,
  "recentSignups": []
}
```

Currently returns placeholder values — needs to be wired to the D1 queries
above.

## Gaps

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| No `first_seen` / `created_at` on mcp-auth users table | Cannot calculate cohort retention | Add `created_at` column (already exists, but verify it's populated on all sign-up flows) |
| No DAU/MAU rollup cron | Must query raw tables for active user counts | Create a cron trigger on spike-land-mcp that writes daily rollups |
| No conversion funnel tracking | Cannot measure sign-up -> first tool call -> purchase | Add funnel stage events to analytics_events |
| No cohort analysis | Cannot track retention week-over-week | Build cohort query using `users.created_at` + `tool_user_daily` |
| No churn tracking | Cannot identify users who stopped using the platform | Define churn (e.g., no tool call in 14 days), create weekly churn cron |
| No revenue attribution | Cannot link MRR to acquisition channels | Add `utm_source` to sign-up events, join with credit_ledger |
| Cockpit dashboard not wired | Dashboard shows placeholder data | Connect to D1 queries in this document |
| No alerting on metric drops | Won't notice DAU decline until manual check | Add cron-based alerting for DAU/error rate thresholds |

## Recommendations (Priority Order)

1. **Wire cockpit dashboard** — connect existing `/api/cockpit/metrics` to real
   D1 queries. Lowest effort, immediate visibility.

2. **Add daily rollup cron** — write DAU, MAU, tool call totals, error rates to
   a `metrics_daily` table. Powers trend charts without querying raw tables.

3. **Track conversion funnel** — emit events for: `sign_up`, `first_tool_call`,
   `first_purchase`. Query funnel with simple SQL aggregations.

4. **Build retention cohorts** — group users by sign-up week, measure % still
   active N weeks later. Requires `users.created_at` to be reliably populated.

5. **Add churn detection** — weekly cron identifies users with no activity in 14
   days. Enables re-engagement campaigns.

6. **Revenue attribution** — capture UTM params at sign-up, join with
   credit_ledger to measure CAC and channel ROI.

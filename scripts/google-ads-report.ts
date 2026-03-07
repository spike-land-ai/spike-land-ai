#!/usr/bin/env npx tsx
/**
 * Google Ads Campaign Performance Report
 *
 * Run after launching the PMax campaign to check metrics.
 *
 * Usage:
 *   GOOGLE_ADS_DEVELOPER_TOKEN=xxx GOOGLE_ADS_CUSTOMER_ID=1234567890 npx tsx scripts/google-ads-report.ts
 *   GOOGLE_ADS_DEVELOPER_TOKEN=xxx GOOGLE_ADS_CUSTOMER_ID=1234567890 npx tsx scripts/google-ads-report.ts --days 30
 */

import { execSync } from "node:child_process";

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, "");
const API_VERSION = "v19";

if (!DEVELOPER_TOKEN || !CUSTOMER_ID) {
  console.error("Missing GOOGLE_ADS_DEVELOPER_TOKEN or GOOGLE_ADS_CUSTOMER_ID");
  process.exit(1);
}

const ACCESS_TOKEN = execSync("gcloud auth application-default print-access-token 2>/dev/null", {
  encoding: "utf-8",
}).trim();

const daysArg = process.argv.indexOf("--days");
const DAYS = daysArg !== -1 ? parseInt(process.argv[daysArg + 1] || "7", 10) : 7;

async function searchStream(query: string): Promise<Record<string, unknown>[]> {
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:searchStream`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "developer-token": DEVELOPER_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const data = (await res.json()) as Record<string, unknown>[];
  if (!res.ok) {
    console.error("Query error:", JSON.stringify(data, null, 2));
    return [];
  }
  return data;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CampaignRow {
  campaign: { name: string; status: string; id: string };
  metrics: {
    impressions: string;
    clicks: string;
    costMicros: string;
    ctr: string;
    averageCpc: string;
    conversions: string;
    costPerConversion: string;
  };
}

interface SearchTermRow {
  searchTermView: { searchTerm: string };
  metrics: { impressions: string; clicks: string; costMicros: string };
}

interface GeoRow {
  geographicView: { countryCriterionId: string };
  geoTargetConstant: { name: string };
  metrics: { impressions: string; clicks: string; costMicros: string };
}

async function main() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS);
  const dateRange = `segments.date BETWEEN '${formatDate(startDate)}' AND '${formatDate(endDate)}'`;

  console.log(`=== Google Ads Performance Report (last ${DAYS} days) ===\n`);

  // 1. Campaign overview
  console.log("--- Campaign Overview ---");
  const campaignData = await searchStream(`
    SELECT
      campaign.name,
      campaign.status,
      campaign.id,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.cost_per_conversion
    FROM campaign
    WHERE ${dateRange}
      AND campaign.advertising_channel_type = 'PERFORMANCE_MAX'
    ORDER BY metrics.cost_micros DESC
  `);

  const campaignRows = (campaignData?.[0] as { results?: CampaignRow[] })?.results || [];
  if (campaignRows.length === 0) {
    console.log("  No Performance Max campaigns found with data in this period.\n");
  } else {
    for (const row of campaignRows) {
      const m = row.metrics;
      const costDollars = (parseInt(m.costMicros || "0", 10) / 1_000_000).toFixed(2);
      const cpcDollars = (parseInt(m.averageCpc || "0", 10) / 1_000_000).toFixed(2);
      const ctr = (parseFloat(m.ctr || "0") * 100).toFixed(2);
      const cpa = parseInt(m.costPerConversion || "0", 10) / 1_000_000;

      console.log(`  ${row.campaign.name} [${row.campaign.status}]`);
      console.log(`    Impressions:  ${parseInt(m.impressions || "0", 10).toLocaleString()}`);
      console.log(`    Clicks:       ${parseInt(m.clicks || "0", 10).toLocaleString()}`);
      console.log(`    CTR:          ${ctr}%  ${parseFloat(ctr) >= 2 ? "(healthy)" : "(below 2% target)"}`);
      console.log(`    Cost:         $${costDollars}`);
      console.log(`    Avg CPC:      $${cpcDollars}  ${parseFloat(cpcDollars) <= 2 ? "(within budget)" : "(above $2 target)"}`);
      console.log(`    Conversions:  ${parseFloat(m.conversions || "0").toFixed(1)}`);
      if (cpa > 0) console.log(`    Cost/Conv:    $${cpa.toFixed(2)}`);
      console.log();
    }
  }

  // 2. Search terms report (top 20)
  console.log("--- Top Search Terms ---");
  const searchData = await searchStream(`
    SELECT
      search_term_view.search_term,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM search_term_view
    WHERE ${dateRange}
      AND campaign.advertising_channel_type = 'PERFORMANCE_MAX'
    ORDER BY metrics.clicks DESC
    LIMIT 20
  `);

  const searchRows = (searchData?.[0] as { results?: SearchTermRow[] })?.results || [];
  if (searchRows.length === 0) {
    console.log("  No search term data yet.\n");
  } else {
    console.log("  Term                                    Impressions  Clicks  Cost");
    console.log("  " + "-".repeat(72));
    for (const row of searchRows) {
      const term = row.searchTermView.searchTerm.padEnd(40).slice(0, 40);
      const imp = parseInt(row.metrics.impressions || "0", 10).toString().padStart(6);
      const clicks = parseInt(row.metrics.clicks || "0", 10).toString().padStart(6);
      const cost = "$" + (parseInt(row.metrics.costMicros || "0", 10) / 1_000_000).toFixed(2).padStart(7);
      console.log(`  ${term}  ${imp}  ${clicks}  ${cost}`);
    }
    console.log();
  }

  // 3. Geographic performance
  console.log("--- Geographic Performance ---");
  const geoData = await searchStream(`
    SELECT
      geographic_view.country_criterion_id,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros
    FROM geographic_view
    WHERE ${dateRange}
      AND campaign.advertising_channel_type = 'PERFORMANCE_MAX'
    ORDER BY metrics.clicks DESC
    LIMIT 10
  `);

  const geoRows = (geoData?.[0] as { results?: GeoRow[] })?.results || [];
  if (geoRows.length === 0) {
    console.log("  No geographic data yet.\n");
  } else {
    for (const row of geoRows) {
      const id = (row.geographicView as { countryCriterionId?: string })?.countryCriterionId ?? "unknown";
      const clicks = parseInt(row.metrics.clicks || "0", 10);
      const cost = (parseInt(row.metrics.costMicros || "0", 10) / 1_000_000).toFixed(2);
      console.log(`  Region ${id}: ${clicks} clicks, $${cost} spent`);
    }
    console.log();
  }

  // 4. Health check
  console.log("--- Health Check ---");
  if (campaignRows.length > 0) {
    const m = campaignRows[0].metrics;
    const ctr = parseFloat(m.ctr || "0") * 100;
    const cpc = parseInt(m.averageCpc || "0", 10) / 1_000_000;
    const totalCost = parseInt(m.costMicros || "0", 10) / 1_000_000;
    const conversions = parseFloat(m.conversions || "0");

    const checks = [
      { label: "CTR >= 2%", pass: ctr >= 2, value: `${ctr.toFixed(2)}%` },
      { label: "CPC <= $2", pass: cpc <= 2, value: `$${cpc.toFixed(2)}` },
      { label: "Conversions tracked", pass: conversions > 0, value: conversions.toFixed(0) },
      { label: "Budget on track", pass: totalCost > 0, value: `$${totalCost.toFixed(2)} spent` },
    ];

    for (const c of checks) {
      console.log(`  ${c.pass ? "PASS" : "WARN"} ${c.label}: ${c.value}`);
    }
  } else {
    console.log("  No data to check yet. Run again after the campaign has served impressions.");
  }

  console.log("\n--- Recommendations ---");
  console.log("  After 7 days:  Check search terms, add negatives for irrelevant queries");
  console.log("  After 14 days: Review placement reports, exclude low-quality sites");
  console.log("  After 30 days: Evaluate cost-per-signup, consider Target CPA bidding");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

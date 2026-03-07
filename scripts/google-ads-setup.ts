#!/usr/bin/env npx tsx
/**
 * Google Ads Performance Max Campaign Setup Script
 *
 * Prerequisites:
 *   1. Create a Google Ads account at ads.google.com
 *   2. Get your developer token: Tools > Setup > API Center
 *   3. Get your customer ID (10-digit number, shown top-right in Google Ads UI)
 *   4. Authenticate gcloud with the adwords scope:
 *        gcloud auth application-default login \
 *          --scopes="https://www.googleapis.com/auth/adwords,https://www.googleapis.com/auth/cloud-platform"
 *
 * Usage:
 *   GOOGLE_ADS_DEVELOPER_TOKEN=xxx GOOGLE_ADS_CUSTOMER_ID=1234567890 npx tsx scripts/google-ads-setup.ts
 *
 * Or set them in ~/.secrets and source it.
 */

import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, "");
const API_VERSION = "v19";
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}`;

if (!DEVELOPER_TOKEN || !CUSTOMER_ID) {
  console.error(`
Missing required environment variables:

  GOOGLE_ADS_DEVELOPER_TOKEN  — from ads.google.com > Tools > Setup > API Center
  GOOGLE_ADS_CUSTOMER_ID      — 10-digit number from Google Ads UI (top-right)

Example:
  GOOGLE_ADS_DEVELOPER_TOKEN=AbCdEfGhIjKlMnOp \\
  GOOGLE_ADS_CUSTOMER_ID=123-456-7890 \\
  npx tsx scripts/google-ads-setup.ts
`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// OAuth token from gcloud
// ---------------------------------------------------------------------------

function getAccessToken(): string {
  try {
    return execSync("gcloud auth application-default print-access-token 2>/dev/null", {
      encoding: "utf-8",
    }).trim();
  } catch {
    console.error("Failed to get access token. Run:");
    console.error('  gcloud auth application-default login --scopes="https://www.googleapis.com/auth/adwords,https://www.googleapis.com/auth/cloud-platform"');
    process.exit(1);
  }
}

const ACCESS_TOKEN = getAccessToken();

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

interface MutateOperation {
  [key: string]: { create?: Record<string, unknown>; update?: Record<string, unknown>; remove?: string };
}

async function mutate(
  endpoint: string,
  operations: MutateOperation[],
): Promise<Record<string, unknown>> {
  const url = `${BASE_URL}/${endpoint}:mutate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "developer-token": DEVELOPER_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ operations }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    console.error(`API error (${endpoint}):`, JSON.stringify(data, null, 2));
    throw new Error(`Google Ads API error: ${res.status} ${res.statusText}`);
  }
  return data;
}

async function googleAdsMutate(
  mutateOperations: Record<string, unknown>[],
): Promise<Record<string, unknown>> {
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}/googleAds:mutate`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "developer-token": DEVELOPER_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mutateOperations }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    console.error("GoogleAds mutate error:", JSON.stringify(data, null, 2));
    throw new Error(`Google Ads API error: ${res.status} ${res.statusText}`);
  }
  return data;
}

async function search(query: string): Promise<Record<string, unknown>[]> {
  const url = `${BASE_URL}/googleAds:searchStream`;
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
    console.error("Search error:", JSON.stringify(data, null, 2));
    throw new Error(`Google Ads search error: ${res.status}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Campaign data
// ---------------------------------------------------------------------------

const HEADLINES = [
  "80+ AI Tools. One Platform.",
  "Build AI Apps Faster",
  "MCP-First Dev Platform",
  "AI Tools Without Plumbing",
  "Free Tier. No Card Needed.",
  "One Protocol. Zero Hassle.",
  "From Idea to AI App Fast",
  "AI Agent Tools Registry",
  "Start Free. Scale to Pro.",
  "Developer-First AI Tools",
  "Connect AI in One Command",
  "spike.land - Ship AI Fast",
  "80+ Tools. One MCP Call.",
  "AI Dev Platform. Free Tier.",
  "Stop Writing Glue Code",
];

const LONG_HEADLINES = [
  "80+ AI Tools Through One Protocol. Build AI Apps Without the Plumbing.",
  "Stop Writing Custom Integrations. One MCP Connection, All the Tools.",
  "Free AI Development Platform with 80+ Tools. No Credit Card Required.",
  "From Image Generation to Code Execution. Everything Your Agent Needs.",
  "AI-Native Dev Platform Running at the Edge. Sub-50ms Latency Worldwide.",
];

const DESCRIPTIONS = [
  "80+ production-ready AI tools via Model Context Protocol. Free tier included.",
  "Image studio, code sandbox, QA automation, chess engine and more. One API.",
  "Connect in one command. Claude, OpenAI, or any MCP client. Start free.",
  "Edge-native platform on Cloudflare Workers. 300+ PoPs. Sub-50ms latency.",
  "Free: 50 credits/day. Pro: $29/mo. Business: $99/mo with unlimited credits.",
];

const SEARCH_THEMES = [
  "AI development platform",
  "AI tools for developers",
  "AI agent builder",
  "AI powered development tools",
  "build AI apps",
  "MCP tools",
  "model context protocol",
  "MCP server",
  "Claude MCP tools",
  "AI tool registry",
  "AI API integration",
  "connect AI tools",
  "AI tool management",
  "simplify AI development",
  "no code AI tools",
  "LangChain alternative",
  "AI middleware platform",
  "AI orchestration tools",
  "AI tool marketplace",
  "developer AI assistant",
  "AI code generation tools",
  "AI image generation API",
  "browser automation AI",
  "AI chess engine",
  "AI workflow automation",
];

const NEGATIVE_KEYWORDS = [
  "free AI",
  "AI course",
  "AI tutorial",
  "learn AI",
  "ChatGPT",
  "AI jobs",
  "AI career",
  "AI art generator free",
];

// Geo target constant for United Kingdom
const UK_GEO_TARGET = "geoTargetConstants/2826";
// Language constant for English
const ENGLISH_LANGUAGE = "languageConstants/1000";

// ---------------------------------------------------------------------------
// Temporary resource IDs (negative numbers for cross-referencing in batch)
// ---------------------------------------------------------------------------

const TEMP_BUDGET_ID = -1;
const TEMP_CAMPAIGN_ID = -2;
const TEMP_ASSET_GROUP_ID = -3;
// Assets start at -100
const TEMP_ASSET_BASE = -100;

// ---------------------------------------------------------------------------
// Build mutate operations
// ---------------------------------------------------------------------------

function buildOperations(): Record<string, unknown>[] {
  const ops: Record<string, unknown>[] = [];

  // 1. Campaign Budget
  ops.push({
    campaignBudgetOperation: {
      create: {
        name: "spike.land PMax - $50/day",
        amountMicros: "50000000", // $50 in micros
        deliveryMethod: "STANDARD",
        explicitlyShared: false,
      },
    },
  });

  // 2. Performance Max Campaign
  ops.push({
    campaignOperation: {
      create: {
        name: "spike.land UK Developer Traffic",
        advertisingChannelType: "PERFORMANCE_MAX",
        status: "PAUSED", // Start paused so you can review before going live
        campaignBudget: `customers/${CUSTOMER_ID}/campaignBudgets/${TEMP_BUDGET_ID}`,
        biddingStrategyType: "MAXIMIZE_CLICKS",
        urlExpansionOptOut: false,
        startDate: formatDate(new Date()),
        finalUrlSuffix: "utm_source=google_ads&utm_medium=pmax&utm_campaign=uk_dev_traffic",
      },
    },
  });

  // 3. Campaign criterion: Location targeting (UK)
  ops.push({
    campaignCriterionOperation: {
      create: {
        campaign: `customers/${CUSTOMER_ID}/campaigns/${TEMP_CAMPAIGN_ID}`,
        location: {
          geoTargetConstant: UK_GEO_TARGET,
        },
      },
    },
  });

  // 4. Campaign criterion: Language targeting (English)
  ops.push({
    campaignCriterionOperation: {
      create: {
        campaign: `customers/${CUSTOMER_ID}/campaigns/${TEMP_CAMPAIGN_ID}`,
        language: {
          languageConstant: ENGLISH_LANGUAGE,
        },
      },
    },
  });

  // 5. Negative keyword list at campaign level
  for (const keyword of NEGATIVE_KEYWORDS) {
    ops.push({
      campaignCriterionOperation: {
        create: {
          campaign: `customers/${CUSTOMER_ID}/campaigns/${TEMP_CAMPAIGN_ID}`,
          negative: true,
          keyword: {
            text: keyword,
            matchType: "BROAD",
          },
        },
      },
    });
  }

  // 6. Asset Group
  ops.push({
    assetGroupOperation: {
      create: {
        name: "Developer AI Tools",
        campaign: `customers/${CUSTOMER_ID}/campaigns/${TEMP_CAMPAIGN_ID}`,
        finalUrls: ["https://spike.land"],
        finalMobileUrls: ["https://spike.land"],
        status: "ENABLED",
      },
    },
  });

  // 7. Text Assets — Headlines
  let assetIdx = 0;
  for (const headline of HEADLINES) {
    const tempId = TEMP_ASSET_BASE - assetIdx;
    ops.push({
      assetOperation: {
        create: {
          resourceName: `customers/${CUSTOMER_ID}/assets/${tempId}`,
          name: `PMax Headline: ${headline.slice(0, 40)}`,
          textAsset: { text: headline },
        },
      },
    });
    ops.push({
      assetGroupAssetOperation: {
        create: {
          assetGroup: `customers/${CUSTOMER_ID}/assetGroups/${TEMP_ASSET_GROUP_ID}`,
          asset: `customers/${CUSTOMER_ID}/assets/${tempId}`,
          fieldType: "HEADLINE",
        },
      },
    });
    assetIdx++;
  }

  // 8. Text Assets — Long Headlines
  for (const headline of LONG_HEADLINES) {
    const tempId = TEMP_ASSET_BASE - assetIdx;
    ops.push({
      assetOperation: {
        create: {
          resourceName: `customers/${CUSTOMER_ID}/assets/${tempId}`,
          name: `PMax Long Headline: ${headline.slice(0, 40)}`,
          textAsset: { text: headline },
        },
      },
    });
    ops.push({
      assetGroupAssetOperation: {
        create: {
          assetGroup: `customers/${CUSTOMER_ID}/assetGroups/${TEMP_ASSET_GROUP_ID}`,
          asset: `customers/${CUSTOMER_ID}/assets/${tempId}`,
          fieldType: "LONG_HEADLINE",
        },
      },
    });
    assetIdx++;
  }

  // 9. Text Assets — Descriptions
  for (const desc of DESCRIPTIONS) {
    const tempId = TEMP_ASSET_BASE - assetIdx;
    ops.push({
      assetOperation: {
        create: {
          resourceName: `customers/${CUSTOMER_ID}/assets/${tempId}`,
          name: `PMax Description: ${desc.slice(0, 40)}`,
          textAsset: { text: desc },
        },
      },
    });
    ops.push({
      assetGroupAssetOperation: {
        create: {
          assetGroup: `customers/${CUSTOMER_ID}/assetGroups/${TEMP_ASSET_GROUP_ID}`,
          asset: `customers/${CUSTOMER_ID}/assets/${tempId}`,
          fieldType: "DESCRIPTION",
        },
      },
    });
    assetIdx++;
  }

  // 10. Business name asset
  {
    const tempId = TEMP_ASSET_BASE - assetIdx;
    ops.push({
      assetOperation: {
        create: {
          resourceName: `customers/${CUSTOMER_ID}/assets/${tempId}`,
          name: "PMax Business Name",
          textAsset: { text: "spike.land" },
        },
      },
    });
    ops.push({
      assetGroupAssetOperation: {
        create: {
          assetGroup: `customers/${CUSTOMER_ID}/assetGroups/${TEMP_ASSET_GROUP_ID}`,
          asset: `customers/${CUSTOMER_ID}/assets/${tempId}`,
          fieldType: "BUSINESS_NAME",
        },
      },
    });
    assetIdx++;
  }

  // 11. Search themes for the asset group
  for (const theme of SEARCH_THEMES) {
    ops.push({
      assetGroupSignalOperation: {
        create: {
          assetGroup: `customers/${CUSTOMER_ID}/assetGroups/${TEMP_ASSET_GROUP_ID}`,
          searchTheme: { text: theme },
        },
      },
    });
  }

  // 12. Audience signal — custom segment with search terms
  // Note: Custom audience / audience signals require creating an audience first.
  // We add the search themes above which serve as the primary signal for PMax.

  return ops;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// Dry-run / verification helpers
// ---------------------------------------------------------------------------

async function verifyAccount(): Promise<boolean> {
  console.log("Verifying Google Ads account access...");
  try {
    const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "developer-token": DEVELOPER_TOKEN!,
      },
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      console.error("Account verification failed:", JSON.stringify(data, null, 2));
      return false;
    }
    console.log(`  Account: ${(data as { descriptiveName?: string }).descriptiveName || CUSTOMER_ID}`);
    return true;
  } catch (err) {
    console.error("Account verification error:", err);
    return false;
  }
}

async function listExistingCampaigns(): Promise<void> {
  console.log("\nExisting campaigns:");
  try {
    const data = await search(
      "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign ORDER BY campaign.id",
    );
    const results = data as { results?: { campaign: { id: string; name: string; status: string; advertisingChannelType: string } }[] }[];
    const rows = results?.[0]?.results;
    if (!rows || rows.length === 0) {
      console.log("  (none)");
    } else {
      for (const row of rows) {
        console.log(`  [${row.campaign.status}] ${row.campaign.name} (${row.campaign.advertisingChannelType})`);
      }
    }
  } catch {
    console.log("  (could not retrieve)");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Google Ads Performance Max Campaign Setup ===");
  console.log(`Customer ID: ${CUSTOMER_ID}`);
  console.log(`API Version: ${API_VERSION}`);
  console.log();

  // Verify account access
  const verified = await verifyAccount();
  if (!verified) {
    console.error("\nCould not verify account. Check your developer token and customer ID.");
    process.exit(1);
  }

  // Show existing campaigns
  await listExistingCampaigns();

  // Check for --dry-run flag
  const isDryRun = process.argv.includes("--dry-run");

  // Build all operations
  const operations = buildOperations();
  console.log(`\nBuilt ${operations.length} operations:`);
  console.log(`  - 1 campaign budget ($50/day)`);
  console.log(`  - 1 Performance Max campaign (PAUSED)`);
  console.log(`  - 1 location target (United Kingdom)`);
  console.log(`  - 1 language target (English)`);
  console.log(`  - ${NEGATIVE_KEYWORDS.length} negative keywords`);
  console.log(`  - 1 asset group ("Developer AI Tools")`);
  console.log(`  - ${HEADLINES.length} headlines`);
  console.log(`  - ${LONG_HEADLINES.length} long headlines`);
  console.log(`  - ${DESCRIPTIONS.length} descriptions`);
  console.log(`  - 1 business name`);
  console.log(`  - ${SEARCH_THEMES.length} search themes`);

  if (isDryRun) {
    console.log("\n[DRY RUN] Would send the following operations:");
    console.log(JSON.stringify(operations, null, 2));
    console.log("\nRe-run without --dry-run to create the campaign.");
    return;
  }

  // Execute
  console.log("\nCreating campaign...");
  try {
    const result = await googleAdsMutate(operations);
    console.log("\nCampaign created successfully!");

    const responses = (result as { mutateOperationResponses?: { campaignResult?: { resourceName: string } }[] })
      .mutateOperationResponses;
    if (responses) {
      const campaignResult = responses.find((r) => r.campaignResult);
      if (campaignResult?.campaignResult) {
        console.log(`  Campaign resource: ${campaignResult.campaignResult.resourceName}`);
      }
    }

    console.log("\n--- IMPORTANT ---");
    console.log("The campaign was created in PAUSED state.");
    console.log("Before enabling it:");
    console.log("  1. Upload image assets (logo, screenshots) in the Google Ads UI");
    console.log("  2. Set up conversion tracking:");
    console.log("     - Go to Tools > Conversions > New conversion action > Website");
    console.log("     - Copy the Conversion ID and Label");
    console.log("     - Set VITE_GOOGLE_ADS_ID and VITE_GOOGLE_ADS_CONVERSION_LABEL in your build env");
    console.log("     - Rebuild and deploy spike-app");
    console.log("  3. Review all assets in the Google Ads UI");
    console.log("  4. Enable the campaign when ready");
    console.log();
    console.log("To enable: Go to ads.google.com > Campaigns > spike.land UK Developer Traffic > Enable");
  } catch (err) {
    console.error("\nFailed to create campaign:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

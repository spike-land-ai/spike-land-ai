#!/usr/bin/env npx tsx
import { chromium } from "playwright";

const URL = "https://spike.land/iwd";

async function main() {
  console.log("=== IWD Page Test ===\n");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: "QA-Studio-Bot/1.0 Playwright",
  });

  const page = await context.newPage();

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  const failedUrls: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("requestfailed", (req) => {
    const f = req.failure();
    if (f) networkErrors.push(req.url().slice(0, 120) + ": " + f.errorText);
  });
  // Capture 403s
  page.on("response", (resp) => {
    if (resp.status() === 403) {
      failedUrls.push(resp.url());
    }
  });

  const start = Date.now();
  const response = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  console.log("HTTP status:", response?.status());
  console.log("Load time:", Date.now() - start, "ms");
  console.log("Title:", await page.title());

  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() =>
    console.log("WARN: network did not idle in 15s")
  );

  // Check map rendered
  const mapEl = await page.$("#map");
  console.log("\n--- Map ---");
  console.log("Map element exists:", mapEl !== null);

  const tileCount = await page.$$eval(".leaflet-tile", (tiles) => tiles.length);
  console.log("Map tiles loaded:", tileCount);

  const leafletContainer = await page.$(".leaflet-container");
  console.log("Leaflet initialized:", leafletContainer !== null);

  // Check banner
  console.log("\n--- Banner ---");
  const bannerText = await page.$eval("#banner", (el) => el.textContent?.trim() ?? "").catch(() => "MISSING");
  console.log("Banner text:", bannerText);

  const counterText = await page.$eval("#counter", (el) => el.textContent?.trim() ?? "").catch(() => "MISSING");
  console.log("Counter value:", counterText);

  // Wait for checkin + visitor load
  console.log("\n--- Visitors ---");
  await page.waitForTimeout(3000);
  const pinCount = await page.$$eval(".visitor-pin", (pins) => pins.length);
  console.log("Visitor pins on map:", pinCount);

  console.log("\n--- 403 URLs ---");
  if (failedUrls.length > 0) {
    for (const u of failedUrls) console.log("  403:", u);
  } else {
    console.log("none");
  }

  console.log("\n--- Console errors ---");
  console.log(consoleErrors.length === 0 ? "none" : consoleErrors);

  console.log("\n--- Network errors ---");
  console.log(networkErrors.length === 0 ? "none" : networkErrors);

  // Verdict: map works, banner works, pins exist
  const hasTiles = tileCount > 0;
  const hasLeaflet = leafletContainer !== null;
  const hasPins = pinCount > 0;
  const passed = hasTiles && hasLeaflet && hasPins;
  console.log("\n=== RESULT:", passed ? "PASS" : "FAIL", "===");

  await browser.close();
  process.exit(passed ? 0 : 1);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });

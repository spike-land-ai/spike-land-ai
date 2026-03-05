/**
 * Headless browser verification of user-test fixes on live spike.land
 */
import { chromium } from "playwright";

const BASE = "https://spike.land";
const results: Array<{ test: string; pass: boolean; detail: string }> = [];

function log(test: string, pass: boolean, detail: string) {
  results.push({ test, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} | ${test} | ${detail}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "spike-land-user-test/1.0",
  });

  // ── Test 1: Navigation bar has Store and About links ──
  {
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });

    const navLinks = await page.$$eval("header nav a, header nav [data-link]", (els) =>
      els.map((el) => ({
        text: el.textContent?.trim(),
        href: el.getAttribute("href"),
      })),
    );
    const texts = navLinks.map((l) => l.text);
    log("Nav: Tools link", texts.includes("Tools"), `Found: ${texts.join(", ")}`);
    log("Nav: Store link", texts.includes("Store"), `Found: ${texts.join(", ")}`);
    log("Nav: Pricing link", texts.includes("Pricing"), `Found: ${texts.join(", ")}`);
    log("Nav: Blog link", texts.includes("Blog"), `Found: ${texts.join(", ")}`);
    log("Nav: About link", texts.includes("About"), `Found: ${texts.join(", ")}`);
    log("Nav: Docs link", texts.some((t) => t === "Docs"), `Found: ${texts.join(", ")}`);
    await page.close();
  }

  // ── Test 2: Footer exists with key links ──
  {
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "networkidle" });
    const footer = await page.$("footer");
    log("Footer: exists", !!footer, footer ? "Footer element found" : "No footer element");

    if (footer) {
      const footerLinks = await footer.$$eval("a", (els) =>
        els.map((el) => el.textContent?.trim()),
      );
      log("Footer: Pricing", footerLinks.includes("Pricing"), `Links: ${footerLinks.join(", ")}`);
      log("Footer: Privacy", footerLinks.some((t) => t === "Privacy Policy"), `Links: ${footerLinks.join(", ")}`);
      log("Footer: Terms", footerLinks.some((t) => t === "Terms of Service"), `Links: ${footerLinks.join(", ")}`);
      log("Footer: Blog", footerLinks.includes("Blog"), `Links: ${footerLinks.join(", ")}`);
    }
    await page.close();
  }

  // ── Test 3: Pricing page loads with 3 tiers ──
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle" });
    const title = await page.title();
    log("Pricing: title", title.includes("Pricing"), `Title: ${title}`);

    const tiers = await page.$$eval("h2", (els) => els.map((el) => el.textContent?.trim()));
    log("Pricing: Free tier", tiers.includes("Free"), `Tiers: ${tiers.join(", ")}`);
    log("Pricing: Pro tier", tiers.includes("Pro"), `Tiers: ${tiers.join(", ")}`);
    log("Pricing: Business tier", tiers.includes("Business"), `Tiers: ${tiers.join(", ")}`);

    // Check annual toggle exists
    const annualBtn = await page.$('button:has-text("Annual")');
    log("Pricing: annual toggle", !!annualBtn, annualBtn ? "Annual toggle found" : "No annual toggle");

    // Check Contact Sales section
    const contactSales = await page.$('a[href="mailto:enterprise@spike.land"]');
    log("Pricing: Contact Sales", !!contactSales, contactSales ? "Contact Sales link found" : "No Contact Sales");
    await page.close();
  }

  // ── Test 4: Sitemap.xml is dynamic with blog posts ──
  {
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}/sitemap.xml`);
    const body = await resp?.text();
    const status = resp?.status();
    log("Sitemap: returns 200", status === 200, `Status: ${status}`);
    log("Sitemap: has XML", body?.includes("<urlset") ?? false, body?.slice(0, 100) ?? "empty");
    log("Sitemap: has /pricing", body?.includes("/pricing") ?? false, "");
    log("Sitemap: has /about", body?.includes("/about") ?? false, "");
    log("Sitemap: has /blog", body?.includes("/blog") ?? false, "");
    log("Sitemap: has blog posts", body?.includes("/blog/") ?? false, "Contains individual blog post URLs");
    await page.close();
  }

  // ── Test 5: API 404 returns JSON ──
  {
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}/api/nonexistent-test-path`);
    const contentType = resp?.headers()["content-type"] ?? "";
    const body = await resp?.text();
    const status = resp?.status();
    log("API 404: returns 404", status === 404, `Status: ${status}`);
    log("API 404: returns JSON", contentType.includes("json"), `Content-Type: ${contentType}`);
    log("API 404: has error field", body?.includes('"error"') ?? false, `Body: ${body?.slice(0, 100)}`);
    await page.close();
  }

  // ── Test 6: robots.txt works ──
  {
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}/robots.txt`);
    const body = await resp?.text();
    log("robots.txt: returns 200", resp?.status() === 200, `Status: ${resp?.status()}`);
    log("robots.txt: has sitemap", body?.includes("Sitemap:") ?? false, body?.slice(0, 200) ?? "");
    await page.close();
  }

  // ── Test 7: security.txt works ──
  {
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}/.well-known/security.txt`);
    const body = await resp?.text();
    log("security.txt: returns 200", resp?.status() === 200, `Status: ${resp?.status()}`);
    log("security.txt: has contact", body?.includes("Contact:") ?? false, body?.slice(0, 200) ?? "");
    await page.close();
  }

  // ── Test 8: manifest.webmanifest works ──
  {
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}/manifest.webmanifest`);
    const body = await resp?.text();
    log("Manifest: returns 200", resp?.status() === 200, `Status: ${resp?.status()}`);
    log("Manifest: valid JSON", (() => { try { JSON.parse(body ?? ""); return true; } catch { return false; } })(), "");
    await page.close();
  }

  // ── Test 9: Health endpoint ──
  {
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}/health`);
    const body = await resp?.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(body ?? "{}"); } catch {}
    log("Health: returns 200", resp?.status() === 200, `Status: ${resp?.status()}`);
    log("Health: has status field", "status" in json, `Body: ${body?.slice(0, 200)}`);
    log("Health: has r2 field", "r2" in json, `Fields: ${Object.keys(json).join(", ")}`);
    log("Health: has d1 field", "d1" in json, `Fields: ${Object.keys(json).join(", ")}`);
    await page.close();
  }

  // ── Test 10: Blog API works ──
  {
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}/api/blog`);
    const body = await resp?.text();
    let posts: unknown[] = [];
    try { posts = JSON.parse(body ?? "[]"); } catch {}
    log("Blog API: returns 200", resp?.status() === 200, `Status: ${resp?.status()}`);
    log("Blog API: returns array", Array.isArray(posts), `Type: ${typeof posts}`);
    log("Blog API: has posts", posts.length > 0, `Count: ${posts.length}`);
    await page.close();
  }

  // ── Test 11: SSR metadata for /pricing ──
  {
    const page = await ctx.newPage();
    // Disable JS to test SSR
    await page.route("**/*.js", (route) => route.abort());
    const resp = await page.goto(`${BASE}/pricing`, { waitUntil: "commit" });
    const html = await resp?.text();
    log("SSR /pricing: has title", html?.includes("Pricing") ?? false, "");
    log("SSR /pricing: has og:title", html?.includes('og:title') ?? false, "");
    log("SSR /pricing: has description", html?.includes('og:description') ?? false, "");
    await page.close();
  }

  // ── Test 12: Learn page quiz ──
  {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/learn`, { waitUntil: "networkidle" });
    const heading = await page.$eval("h1", (el) => el.textContent?.trim()).catch(() => "");
    log("Learn: page loads", heading?.includes("Learn") ?? false, `Heading: ${heading}`);
    await page.close();
  }

  // ── Test 13: noscript fallback ──
  {
    const page = await ctx.newPage();
    // Fetch raw HTML without JS
    await page.goto(BASE, { waitUntil: "commit" });
    const html = await page.content();
    log("noscript: has fallback", html.includes("<noscript>"), "");
    log("noscript: has message", html.includes("JavaScript Required") || html.includes("JavaScript"), "");
    await page.close();
  }

  await browser.close();

  // ── Summary ──
  console.log("\n" + "=".repeat(60));
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${results.length} tests`);
  if (failed > 0) {
    console.log("\nFAILED TESTS:");
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  ✗ ${r.test}: ${r.detail}`);
    }
  }
  console.log("=".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(2);
});

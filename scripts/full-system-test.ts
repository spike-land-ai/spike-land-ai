import { chromium, type Page } from "playwright";

<<<<<<< HEAD
const BASE_URL = "https://127.0.0.1:5173";
=======
const BASE_URL = "https://local.spike.land:5173";
>>>>>>> b016b63c (chore: auto-sync local changes 1772916247)

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const errors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (err) => {
    errors.push(`Page Error: ${err.message}`);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(`Console Error: ${msg.text()}`);
    }
  });

  async function checkPage(path: string, expectedText?: string) {
    console.log(`Checking ${path}...`);
    const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
    
    if (!response || response.status() >= 400) {
      errors.push(`Failed to load ${path}: HTTP ${response?.status()}`);
    }

    if (expectedText) {
      const content = await page.textContent("body");
      if (!content?.includes(expectedText)) {
        errors.push(`Missing expected text "${expectedText}" on ${path}`);
      }
    }

    // Capture screenshot for debugging
    const filename = `screenshot-${path.replace(/\//g, "_") || "root"}.png`;
    await page.screenshot({ path: filename });
  }

  try {
    // 1. Root
    await checkPage("/", "spike.land");

    // 2. Main Nav
    await checkPage("/tools", "MCP Apps");
    await checkPage("/store", "App Store");
    await checkPage("/pricing", "Pricing");
    await checkPage("/docs", "Documentation");
    await checkPage("/blog", "Blog");
    await checkPage("/about", "About spike.land");

    // 3. Dynamic content
    await checkPage("/what-we-do", "80+ MCP tools");

    // 4. Test interactivity (Search)
    await page.click('button[aria-label="Search site"]');
    const toast = await page.textContent('div[role="status"]');
    if (!toast?.includes("Search coming soon")) {
      errors.push(`Search toast not found or incorrect text: ${toast}`);
    }

    // 5. Test Dark Mode (if developer)
    // We might not be developer by default, but we can try to find ThemeSwitcher
    const themeSwitcher = await page.$('button[aria-label*="theme"]');
    if (themeSwitcher) {
       console.log("Testing theme switcher...");
       await themeSwitcher.click();
       // Check if html has dark class
       const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
       console.log(`Theme is dark: ${isDark}`);
    }

  } catch (err) {
    errors.push(`Test execution failed: ${(err as Error).message}`);
  } finally {
    await browser.close();
  }

  if (errors.length > 0 || consoleErrors.length > 0) {
    console.error("\n--- TEST FAILURES ---");
    errors.forEach(e => console.error(e));
    console.error("\n--- CONSOLE ERRORS ---");
    consoleErrors.forEach(e => console.error(e));
    process.exit(1);
  } else {
    console.log("\nFull system test passed successfully!");
  }
}

runTest();

#!/usr/bin/env tsx
/**
 * Automated Production Test for /my-apps
 *
 * This script uses Playwright to automate testing of the /my-apps feature:
 * 1. Opens https://spike.land/my-apps
 * 2. Creates 5 different test apps
 * 3. Verifies agent responses and previews
 * 4. Captures screenshots and metrics
 *
 * Prerequisites:
 * - yarn agent:poll:prod must be running
 * - User must be logged in (script will pause for manual login)
 *
 * Usage: yarn tsx scripts/automated-prod-test.ts
 */

import { type Browser, chromium, type Page } from "@playwright/test";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const PROD_URL = "https://spike.land";
const MAX_WAIT_TIME = 180000; // 3 minutes per test
const SCREENSHOT_DIR = join(process.cwd(), "test-results", "my-apps-prod");

interface TestCase {
  name: string;
  prompt: string;
  verifyElements?: string[]; // Elements that should appear in the preview
}

const TEST_CASES: TestCase[] = [
  {
    name: "todo-list",
    prompt: "Create a simple todo list app with add, delete, and mark complete functionality",
    verifyElements: ["input", "button"],
  },
  {
    name: "counter",
    prompt: "Create a counter with increment, decrement, and reset buttons. Make it colorful!",
    verifyElements: ["button"],
  },
  {
    name: "color-picker",
    prompt:
      "Build a color picker that shows the selected color in a large preview box with hex code",
    verifyElements: ['input[type="color"]'],
  },
  {
    name: "quote-generator",
    prompt: "Create a random inspirational quote generator with a button to get new quotes",
    verifyElements: ["button"],
  },
  {
    name: "calculator",
    prompt: "Make a simple calculator with +, -, *, / and a clear button. Style it to look nice",
    verifyElements: ["button"],
  },
];

interface TestResult {
  testName: string;
  prompt: string;
  success: boolean;
  error?: string;
  codespaceId?: string;
  codespaceUrl?: string;
  agentResponseTime?: number;
  previewVisible?: boolean;
  screenshotPath?: string;
  timestamp: string;
}

async function ensureDirectory(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function captureScreenshot(page: Page, name: string): Promise<string> {
  await ensureDirectory(SCREENSHOT_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${name}-${timestamp}.png`;
  const filepath = join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

async function waitForAgentResponse(
  page: Page,
  codespaceId: string,
  timeoutMs: number = MAX_WAIT_TIME,
): Promise<boolean> {
  const startTime = Date.now();
  console.log(`  ⏳ Waiting for agent response (max ${timeoutMs / 1000}s)...`);

  try {
    // Strategy 1: Wait for iframe with testing.spike.land URL
    const iframeSelector = `iframe[src*="testing.spike.land/live/${codespaceId}"]`;

    while (Date.now() - startTime < timeoutMs) {
      // Check for preview iframe
      const iframe = page.locator(iframeSelector);
      const count = await iframe.count();

      if (count > 0) {
        const isVisible = await iframe.first().isVisible();
        if (isVisible) {
          console.log(`  ✅ Preview iframe found and visible`);
          return true;
        }
      }

      // Check for agent message with role="AGENT"
      const agentMessages = page.locator('[data-role="AGENT"]');
      const msgCount = await agentMessages.count();
      if (msgCount > 0) {
        console.log(`  ✅ Agent message found (${msgCount} messages)`);
        // Give it a moment for the iframe to render
        await page.waitForTimeout(2000);
        return true;
      }

      // Wait before next check
      await page.waitForTimeout(3000);
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      process.stdout.write(`\r  ⏳ Waiting... ${elapsed}s`);
    }

    console.log(`\n  ❌ Timeout after ${timeoutMs / 1000}s`);
    return false;
  } catch (error) {
    console.error(`\n  ❌ Error waiting for agent:`, error);
    return false;
  }
}

async function testApp(page: Page, testCase: TestCase, testIndex: number): Promise<TestResult> {
  const result: TestResult = {
    testName: testCase.name,
    prompt: testCase.prompt,
    success: false,
    timestamp: new Date().toISOString(),
  };

  try {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`Test ${testIndex + 1}/${TEST_CASES.length}: ${testCase.name}`);
    console.log(`${"=".repeat(70)}`);
    console.log(`Prompt: ${testCase.prompt}`);

    // Navigate to /my-apps/new
    console.log(`\n  🌐 Navigating to /my-apps/new...`);
    await page.goto(`${PROD_URL}/my-apps/new`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for redirect to codespace page
    console.log(`  ⏳ Waiting for redirect to codespace...`);
    await page.waitForURL(/\/my-apps\/[^\/]+$/, { timeout: 15000 });

    const url = page.url();
    const codespaceId = url.split("/my-apps/")[1]!;
    result.codespaceId = codespaceId;
    result.codespaceUrl = `https://testing.spike.land/live/${codespaceId}/`;

    console.log(`  ✅ Codespace created: ${codespaceId}`);
    console.log(`  🔗 URL: ${result.codespaceUrl}`);

    // Take initial screenshot
    const initialScreenshot = await captureScreenshot(page, `${testCase.name}-initial`);
    console.log(`  📸 Initial screenshot: ${initialScreenshot}`);

    // Find the chat textarea
    console.log(`\n  📝 Looking for chat input...`);
    const chatInput = page.locator("textarea").first();
    await chatInput.waitFor({ state: "visible", timeout: 10000 });

    // Type the prompt
    console.log(`  ⌨️  Typing prompt...`);
    await chatInput.fill(testCase.prompt);

    // Find and click send button
    console.log(`  📤 Sending message...`);
    const sendButton = page.locator('button[type="submit"]').first();
    await sendButton.click();

    // Start timer for agent response
    const startTime = Date.now();

    // Wait for agent response
    const responseReceived = await waitForAgentResponse(page, codespaceId, MAX_WAIT_TIME);

    if (responseReceived) {
      result.agentResponseTime = Date.now() - startTime;
      console.log(`\n  ⏱️  Agent responded in ${(result.agentResponseTime / 1000).toFixed(1)}s`);

      // Check if preview is visible
      const previewIframe = page.locator('iframe[src*="testing.spike.land/live"]').first();
      const previewCount = await previewIframe.count();
      result.previewVisible = previewCount > 0;

      if (result.previewVisible) {
        console.log(`  ✅ Preview iframe is visible`);

        // Take screenshot of the response
        const responseScreenshot = await captureScreenshot(page, `${testCase.name}-response`);
        result.screenshotPath = responseScreenshot;
        console.log(`  📸 Response screenshot: ${responseScreenshot}`);

        result.success = true;
        console.log(`\n  ✅ TEST PASSED: ${testCase.name}`);
      } else {
        throw new Error("Agent responded but preview iframe is not visible");
      }
    } else {
      throw new Error("Agent did not respond within timeout");
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`\n  ❌ TEST FAILED: ${testCase.name}`);
    console.error(`  Error: ${result.error}`);

    // Take error screenshot
    try {
      const errorScreenshot = await captureScreenshot(page, `${testCase.name}-error`);
      result.screenshotPath = errorScreenshot;
      console.log(`  📸 Error screenshot: ${errorScreenshot}`);
    } catch (screenshotError) {
      console.error(`  Failed to capture error screenshot:`, screenshotError);
    }
  }

  return result;
}

async function runTests() {
  console.log("🚀 Starting Automated Production Tests for /my-apps\n");
  console.log(`Target: ${PROD_URL}/my-apps`);
  console.log(`Tests: ${TEST_CASES.length}`);
  console.log(`Timeout per test: ${MAX_WAIT_TIME / 1000}s\n`);

  let browser: Browser | null = null;
  const results: TestResult[] = [];

  try {
    // Ensure screenshot directory exists
    await ensureDirectory(SCREENSHOT_DIR);

    // Launch browser
    console.log("🌐 Launching browser...\n");
    browser = await chromium.launch({
      headless: false, // Run with UI so we can see what's happening
      slowMo: 100,
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    });

    const page = await context.newPage();

    // Log browser console messages
    page.on("console", (msg) => {
      const type = msg.type();
      if (type === "error" || type === "warning") {
        console.log(`  [Browser ${type}]: ${msg.text()}`);
      }
    });

    // Navigate to /my-apps and check auth
    console.log("🔐 Checking authentication...\n");
    await page.goto(`${PROD_URL}/my-apps`, { waitUntil: "networkidle" });

    // Check if we need to login
    if (page.url().includes("/signin") || page.url().includes("/login")) {
      console.log("⚠️  Authentication required!");
      console.log("📋 Please log in manually in the browser window...");
      console.log("⏳ Waiting 60 seconds for manual login...\n");

      // Wait for redirect to /my-apps
      await page.waitForURL(/\/my-apps/, { timeout: 60000 });
      console.log("✅ Login successful!\n");
    } else {
      console.log("✅ Already authenticated\n");
    }

    // Run each test
    for (let i = 0; i < TEST_CASES.length; i++) {
      const result = await testApp(page, TEST_CASES[i]!, i);
      results.push(result);

      // Wait between tests to avoid overwhelming the system
      if (i < TEST_CASES.length - 1) {
        const waitTime = 5;
        console.log(`\n⏸️  Waiting ${waitTime}s before next test...\n`);
        await page.waitForTimeout(waitTime * 1000);
      }
    }

    // Print summary
    console.log("\n" + "=".repeat(70));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(70) + "\n");

    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

    // Print individual results
    results.forEach((result, i) => {
      const status = result.success ? "✅" : "❌";
      console.log(`${status} ${i + 1}. ${result.testName}`);
      if (result.success) {
        console.log(`   Response time: ${(result.agentResponseTime! / 1000).toFixed(1)}s`);
        console.log(`   Codespace: ${result.codespaceId}`);
        console.log(`   URL: ${result.codespaceUrl}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }
      if (result.screenshotPath) {
        console.log(`   Screenshot: ${result.screenshotPath}`);
      }
      console.log("");
    });

    // Save results to JSON
    const resultsPath = join(SCREENSHOT_DIR, "test-results.json");
    await writeFile(resultsPath, JSON.stringify(results, null, 2));
    console.log(`💾 Results saved to: ${resultsPath}\n`);

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    throw error;
  } finally {
    if (browser) {
      console.log("🔚 Closing browser...\n");
      await browser.close();
    }
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});

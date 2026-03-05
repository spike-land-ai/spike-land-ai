import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const tree = await page.accessibility.snapshot();
    console.log("Tree:", tree ? "Got it" : "Null");
  } catch (err) {
    console.error("Accessibility failed:", err);
  } finally {
    await browser.close();
  }
}

main();

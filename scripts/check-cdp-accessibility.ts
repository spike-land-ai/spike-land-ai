import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("https://spike.land");
  try {
    const client = await page.context().newCDPSession(page);
    const result = await client.send('Accessibility.getFullAXTree');
    console.log("Nodes count:", result.nodes.length);
    console.log("First node:", JSON.stringify(result.nodes[0], null, 2));
  } catch (err) {
    console.error("CDP failed:", err);
  } finally {
    await browser.close();
  }
}

main();

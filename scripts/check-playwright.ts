import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  console.log("Page keys:", Object.keys(page));
  console.log("Accessibility:", (page as any).accessibility);
  await browser.close();
}

main();

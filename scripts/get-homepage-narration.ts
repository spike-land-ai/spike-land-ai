import { getOrCreateTab, getPageSnapshot, cleanup } from "../src/qa-studio/browser-session.ts";
import { narrate } from "../src/qa-studio/narrate.ts";

async function main() {
  try {
    const { page } = await getOrCreateTab(0);
    console.error("Navigating to https://spike.land...");
    await page.goto("https://spike.land", { waitUntil: "networkidle" });
    const snapshot = await getPageSnapshot();
    if (snapshot?.tree) {
      const result = narrate(snapshot.tree, snapshot.title, snapshot.url);
      console.log(result.text);
    } else {
      console.error("Failed to get page snapshot.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await cleanup();
  }
}

main();

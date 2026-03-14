#!/usr/bin/env tsx
import { deployWorkers } from "./bazdmeg/deploy.js";

async function main() {
  console.log("🚀 Deploying Workers...");
  try {
    const deployed = deployWorkers();
    console.log("\n✅ Deployed workers:", deployed.length > 0 ? deployed.join(", ") : "none");
  } catch (err) {
    console.error("\n❌ Worker deployment failed:", err);
    process.exit(1);
  }
}

main();

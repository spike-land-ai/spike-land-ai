#!/usr/bin/env tsx
import { runPhase3 } from "./bazdmeg/deploy.js";

async function main() {
  console.log("🚀 Starting BAZDMEG Phase 3 Deployment...");
  try {
    const result = runPhase3();
    console.log("\n✅ Deployment summary:");
    console.log(`  SPA: ${result.spaUploaded} uploaded, ${result.spaSkipped} skipped`);
    console.log(
      `  Workers: ${result.workersDeployed.length > 0 ? result.workersDeployed.join(", ") : "none"}`,
    );
    console.log(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error("\n❌ Deployment failed:", err);
    process.exit(1);
  }
}

main();

#!/usr/bin/env npx tsx
/**
 * Reset Staging Database Script
 *
 * Resets the Neon staging branch to match production data.
 * This is useful for refreshing staging with fresh production data.
 *
 * SAFETY: This script is HARDCODED to only reset the "staging" branch.
 * It will NEVER touch production, regardless of environment variables.
 *
 * Usage:
 *   yarn reset:db           # Shows warning and requires confirmation
 *   yarn reset:db --confirm # Actually performs the reset
 *
 * Required Environment Variables:
 *   NEON_API_KEY      - Neon API key with branch management permissions
 *   NEON_PROJECT_ID   - Neon project ID (e.g., dark-flower-44506554)
 */

// SAFETY: Hardcoded branch name - NEVER change this to "main" or production branch names
const STAGING_BRANCH_NAME = "staging";

// SAFETY: Patterns that should NEVER be reset
const FORBIDDEN_PATTERNS = ["main", "production", "prod", "primary"];

interface NeonBranch {
  id: string;
  name: string;
  current_state: string;
  parent_id?: string;
}

interface NeonBranchesResponse {
  branches: NeonBranch[];
}

interface NeonResetResponse {
  branch: NeonBranch;
  operations: Array<{
    id: string;
    action: string;
    status: string;
  }>;
}

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("  SPIKE.LAND Staging Database Reset");
  console.log("=".repeat(60) + "\n");

  // Check for required environment variables
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;

  if (!apiKey) {
    console.error("Error: NEON_API_KEY environment variable is required");
    console.error("Get your API key from: https://console.neon.tech/app/settings/api-keys");
    process.exit(1);
  }

  if (!projectId) {
    console.error("Error: NEON_PROJECT_ID environment variable is required");
    console.error("Your project ID is: dark-flower-44506554");
    process.exit(1);
  }

  // Check for confirmation flag
  const hasConfirmFlag = process.argv.includes("--confirm");

  if (!hasConfirmFlag) {
    console.log("WARNING: This will REPLACE all staging database data!");
    console.log("");
    console.log("The staging database at next.spike.land will be reset");
    console.log("to match the current production database state.");
    console.log("");
    console.log("All staging data (test users, test orders, etc.) will be LOST.");
    console.log("");
    console.log("To proceed, run:");
    console.log("  yarn reset:db --confirm");
    console.log("");
    process.exit(0);
  }

  // SAFETY CHECK: Verify we're targeting the staging branch
  console.log(`Target branch: ${STAGING_BRANCH_NAME}`);
  console.log("");

  // Extra safety: Check for forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (STAGING_BRANCH_NAME.toLowerCase().includes(pattern)) {
      console.error(`SAFETY ERROR: Branch name contains forbidden pattern "${pattern}"`);
      console.error("This script will NEVER reset production branches.");
      process.exit(1);
    }
  }

  try {
    // Step 1: Get all branches to find staging branch ID
    console.log("Fetching Neon branches...");

    const branchesResponse = await fetch(
      `https://console.neon.tech/api/v2/projects/${projectId}/branches`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!branchesResponse.ok) {
      const error = await branchesResponse.text();
      throw new Error(`Failed to fetch branches: ${branchesResponse.status} ${error}`);
    }

    const branchesData = (await branchesResponse.json()) as NeonBranchesResponse;
    const stagingBranch = branchesData.branches.find((b) => b.name === STAGING_BRANCH_NAME);

    if (!stagingBranch) {
      console.error(`Error: Staging branch "${STAGING_BRANCH_NAME}" not found.`);
      console.error("");
      console.error("Available branches:");
      for (const branch of branchesData.branches) {
        console.error(`  - ${branch.name} (${branch.id})`);
      }
      console.error("");
      console.error("Please create a staging branch first:");
      console.error(
        "  neonctl branches create --project-id $NEON_PROJECT_ID --name staging --parent main",
      );
      process.exit(1);
    }

    console.log(`Found staging branch: ${stagingBranch.id}`);
    console.log("");

    // Step 2: Reset the staging branch
    console.log("Resetting staging branch to match production...");

    const resetResponse = await fetch(
      `https://console.neon.tech/api/v2/projects/${projectId}/branches/${stagingBranch.id}/reset`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ parent: true }),
      },
    );

    if (!resetResponse.ok) {
      const error = await resetResponse.text();
      throw new Error(`Failed to reset branch: ${resetResponse.status} ${error}`);
    }

    const resetData = (await resetResponse.json()) as NeonResetResponse;

    console.log("");
    console.log("=".repeat(60));
    console.log("  SUCCESS: Staging database has been reset!");
    console.log("=".repeat(60));
    console.log("");
    console.log("The staging database now matches production data.");
    console.log("");
    console.log("Details:");
    console.log(`  Branch: ${resetData.branch.name}`);
    console.log(`  State: ${resetData.branch.current_state}`);
    if (resetData.operations?.length > 0) {
      console.log(`  Operations: ${resetData.operations.map((o) => o.action).join(", ")}`);
    }
    console.log("");
  } catch (error) {
    console.error("");
    console.error("=".repeat(60));
    console.error("  ERROR: Failed to reset staging database");
    console.error("=".repeat(60));
    console.error("");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    process.exit(1);
  }
}

main();

/**
 * Backfill Script: Migrate CampaignBrief JSON data to Typed Models
 *
 * Phase 4 of the Schema Improvement Plan - JSON Extraction
 *
 * This script migrates existing JSON data from CampaignBrief.targetAudience
 * and CampaignBrief.campaignObjectives to the new typed models:
 * - CampaignTargetAudience (1:1 relationship)
 * - CampaignObjective (1:many relationship)
 *
 * Usage:
 *   yarn tsx scripts/backfill-campaign-briefs.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without applying them
 *
 * @see docs/JSON_SCHEMAS.md for JSON column documentation
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { type ObjectiveType, PrismaClient } from "@prisma/client";
import { CampaignObjectivesSchema, TargetAudienceSchema } from "@spike-land-ai/shared/validations";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();

// Statistics tracking
interface Stats {
  totalBriefs: number;
  processedBriefs: number;
  skippedBriefs: number;
  audiencesCreated: number;
  objectivesCreated: number;
  errors: number;
}

const stats: Stats = {
  totalBriefs: 0,
  processedBriefs: 0,
  skippedBriefs: 0,
  audiencesCreated: 0,
  objectivesCreated: 0,
  errors: 0,
};

// Map JSON objective types to enum
const objectiveTypeMap: Record<string, ObjectiveType> = {
  AWARENESS: "AWARENESS",
  ENGAGEMENT: "ENGAGEMENT",
  CONVERSION: "CONVERSION",
  RETENTION: "RETENTION",
  ADVOCACY: "ADVOCACY",
};

async function backfillCampaignBrief(
  briefId: string,
  targetAudienceJson: unknown,
  campaignObjectivesJson: unknown,
  dryRun: boolean,
): Promise<void> {
  // Validate and parse target audience JSON
  const audienceResult = TargetAudienceSchema.safeParse(targetAudienceJson);
  const objectivesResult = CampaignObjectivesSchema.safeParse(campaignObjectivesJson);

  if (!audienceResult.success) {
    console.warn(
      `  [WARN] Brief ${briefId}: Invalid targetAudience JSON:`,
      audienceResult.error.issues,
    );
  }

  if (!objectivesResult.success) {
    console.warn(
      `  [WARN] Brief ${briefId}: Invalid campaignObjectives JSON:`,
      objectivesResult.error.issues,
    );
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would migrate brief ${briefId}`);
    if (audienceResult.success) {
      console.log(
        `    - Target audience: ageRange=${audienceResult.data.ageRange?.min}-${audienceResult.data.ageRange?.max}, ` +
          `genders=${audienceResult.data.genders?.length ?? 0}, ` +
          `locations=${audienceResult.data.locations?.length ?? 0}`,
      );
    }
    if (objectivesResult.success) {
      console.log(`    - Objectives: ${objectivesResult.data.length} objectives`);
    }
    stats.processedBriefs++;
    return;
  }

  // Use transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Create CampaignTargetAudience if valid JSON
    if (audienceResult.success && audienceResult.data) {
      const audience = audienceResult.data;
      await tx.campaignTargetAudience.upsert({
        where: { briefId },
        create: {
          briefId,
          ageMin: audience.ageRange?.min ?? null,
          ageMax: audience.ageRange?.max ?? null,
          genders: audience.genders ?? [],
          locations: audience.locations ?? [],
          interests: audience.interests ?? [],
          behaviors: audience.behaviors ?? [],
        },
        update: {
          ageMin: audience.ageRange?.min ?? null,
          ageMax: audience.ageRange?.max ?? null,
          genders: audience.genders ?? [],
          locations: audience.locations ?? [],
          interests: audience.interests ?? [],
          behaviors: audience.behaviors ?? [],
        },
      });
      stats.audiencesCreated++;
    }

    // Create CampaignObjective records if valid JSON
    if (objectivesResult.success && objectivesResult.data.length > 0) {
      // Delete existing objectives first (upsert by briefId + type is complex)
      await tx.campaignObjective.deleteMany({
        where: { briefId },
      });

      // Create new objectives
      for (const obj of objectivesResult.data) {
        const objectiveType = objectiveTypeMap[obj.type];
        if (!objectiveType) {
          console.warn(`  [WARN] Brief ${briefId}: Unknown objective type: ${obj.type}`);
          continue;
        }

        await tx.campaignObjective.create({
          data: {
            briefId,
            type: objectiveType,
            metric: obj.metric,
            targetValue: obj.targetValue ?? null,
            deadline: obj.deadline ? new Date(obj.deadline) : null,
            priority: obj.priority ?? 0,
          },
        });
        stats.objectivesCreated++;
      }
    }
  });

  stats.processedBriefs++;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("=".repeat(60));
  console.log("CampaignBrief JSON to Typed Model Backfill");
  console.log("Phase 4 - Schema Improvement Plan");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`);
  console.log("");

  // Fetch all CampaignBriefs with JSON data
  const briefs = await prisma.campaignBrief.findMany({
    select: {
      id: true,
      name: true,
      targetAudience: true,
      campaignObjectives: true,
      targetAudienceTyped: true,
      objectivesTyped: true,
    },
  });

  stats.totalBriefs = briefs.length;
  console.log(`Found ${stats.totalBriefs} CampaignBriefs to process\n`);

  if (stats.totalBriefs === 0) {
    console.log("No CampaignBriefs found. Nothing to migrate.");
    return;
  }

  // Process each brief
  for (const brief of briefs) {
    console.log(`Processing brief: ${brief.id} (${brief.name})`);

    // Skip if already migrated (typed models exist)
    if (brief.targetAudienceTyped || brief.objectivesTyped.length > 0) {
      console.log(`  [SKIP] Already migrated`);
      stats.skippedBriefs++;
      continue;
    }

    try {
      await backfillCampaignBrief(brief.id, brief.targetAudience, brief.campaignObjectives, dryRun);
      console.log(`  [OK] Migrated successfully`);
    } catch (error) {
      console.error(`  [ERROR] Failed to migrate:`, error);
      stats.errors++;
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("Migration Summary");
  console.log("=".repeat(60));
  console.log(`Total briefs:       ${stats.totalBriefs}`);
  console.log(`Processed:          ${stats.processedBriefs}`);
  console.log(`Skipped (existing): ${stats.skippedBriefs}`);
  console.log(`Audiences created:  ${stats.audiencesCreated}`);
  console.log(`Objectives created: ${stats.objectivesCreated}`);
  console.log(`Errors:             ${stats.errors}`);

  if (dryRun) {
    console.log("\n[DRY RUN] No changes were made to the database.");
    console.log("Run without --dry-run to apply changes.");
  }

  // Verification query (non-dry-run)
  if (!dryRun && stats.processedBriefs > 0) {
    console.log("\n" + "=".repeat(60));
    console.log("Verification");
    console.log("=".repeat(60));

    const [briefCount, audienceCount, objectiveCount] = await Promise.all([
      prisma.campaignBrief.count(),
      prisma.campaignTargetAudience.count(),
      prisma.campaignObjective.count(),
    ]);

    console.log(`CampaignBriefs:         ${briefCount}`);
    console.log(`CampaignTargetAudiences: ${audienceCount}`);
    console.log(`CampaignObjectives:      ${objectiveCount}`);

    if (audienceCount < briefCount) {
      console.log(`\n[NOTE] ${briefCount - audienceCount} briefs have no target audience data`);
    }
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

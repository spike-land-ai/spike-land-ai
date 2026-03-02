/**
 * Data Migration Script: Migrate users to stable email-based IDs
 *
 * This script:
 * 1. Checks for active sessions (migration lock)
 * 2. Finds all users with emails
 * 3. Calculates their new stable ID based on email + USER_ID_SALT (or AUTH_SECRET) salt
 * 4. Merges data from old IDs to new stable IDs
 * 5. Updates all related records (images, tokens, jobs, albums)
 *
 * DEPLOYMENT ORDER:
 * 1. Backup database: pg_dump -Fc $DATABASE_URL > backup_before_migration.dump
 * 2. Stop application (to prevent race conditions during migration)
 * 3. Run database migration: yarn prisma migrate deploy
 * 4. Run this script: npx ts-node --esm scripts/migrate-users-to-stable-ids.ts
 * 5. Deploy new code with stable user IDs
 * 6. Start application
 *
 * ROLLBACK (if needed):
 * 1. Stop application
 * 2. Restore database: pg_restore -c -d $DATABASE_URL backup_before_migration.dump
 * 3. Deploy previous code version
 * 4. Start application
 *
 * Usage:
 *   npx ts-node --esm scripts/migrate-users-to-stable-ids.ts               # Run migration
 *   npx ts-node --esm scripts/migrate-users-to-stable-ids.ts --dry-run     # Preview only
 *   npx ts-node --esm scripts/migrate-users-to-stable-ids.ts --force       # Skip session check
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

/**
 * Creates a stable user ID using HMAC-SHA256.
 * MUST match the implementation in src/auth.ts exactly.
 * Uses HMAC for better security (prevents collision attacks).
 */
function createStableUserId(email: string): string {
  const salt = process.env.USER_ID_SALT || process.env.AUTH_SECRET;
  if (!salt) {
    throw new Error("USER_ID_SALT or AUTH_SECRET environment variable must be set");
  }
  // Use HMAC for better security (prevents collision attacks)
  const hash = crypto
    .createHmac("sha256", salt)
    .update(email.toLowerCase().trim())
    .digest("hex")
    .substring(0, 32);
  return `user_${hash}`;
}

/**
 * Checks for active sessions to prevent race conditions during migration.
 * Returns true if it's safe to proceed, false if active sessions exist.
 */
async function checkNoActiveSessions(force: boolean): Promise<boolean> {
  if (force) {
    console.log("WARNING: Skipping session check (--force flag used)");
    return true;
  }

  const activeSessions = await prisma.session.count({
    where: {
      expires: { gt: new Date() },
    },
  });

  if (activeSessions > 0) {
    console.error(`\nERROR: ${activeSessions} active session(s) found!`);
    console.error("This indicates the application may still be running.");
    console.error("\nTo prevent race conditions, please:");
    console.error("1. Stop the application");
    console.error("2. Wait for sessions to expire, or clear the sessions table");
    console.error("3. Run this script again");
    console.error("\nOr use --force to skip this check (not recommended)");
    return false;
  }

  console.log("No active sessions found - safe to proceed");
  return true;
}

interface MigrationStats {
  usersProcessed: number;
  usersMigrated: number;
  imagesMigrated: number;
  jobsMigrated: number;
  tokenBalancesMigrated: number;
  tokenTransactionsMigrated: number;
  albumsMigrated: number;
  stripeIdsMigrated: number;
  errors: string[];
  warnings: string[];
}

async function migrateUsers(dryRun = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    usersProcessed: 0,
    usersMigrated: 0,
    imagesMigrated: 0,
    jobsMigrated: 0,
    tokenBalancesMigrated: 0,
    tokenTransactionsMigrated: 0,
    albumsMigrated: 0,
    stripeIdsMigrated: 0,
    errors: [],
    warnings: [],
  };

  console.log("Starting user migration to stable email-based IDs...");
  if (dryRun) {
    console.log("*** DRY RUN MODE - No changes will be made ***\n");
  }

  // Get all users with emails
  const users = await prisma.user.findMany({
    where: {
      email: { not: null },
    },
    include: {
      enhancedImages: true,
      enhancementJobs: true,
      tokenBalance: true,
      tokenTransactions: true,
      albums: true,
    },
  });

  console.log(`Found ${users.length} users with emails`);

  for (const user of users) {
    stats.usersProcessed++;

    if (!user.email) {
      console.log(`Skipping user ${user.id} - no email`);
      continue;
    }

    const stableId = createStableUserId(user.email);

    // Skip if already using stable ID
    if (user.id === stableId) {
      console.log(`User ${user.email} already has stable ID`);
      continue;
    }

    console.log(`Migrating user ${user.email}: ${user.id} -> ${stableId}`);
    console.log(
      `  Images: ${user.enhancedImages.length}, Jobs: ${user.enhancementJobs.length}, Albums: ${user.albums.length}`,
    );

    if (dryRun) {
      stats.usersMigrated++;
      stats.imagesMigrated += user.enhancedImages.length;
      stats.jobsMigrated += user.enhancementJobs.length;
      stats.albumsMigrated += user.albums.length;
      if (user.tokenBalance) stats.tokenBalancesMigrated++;
      stats.tokenTransactionsMigrated += user.tokenTransactions.length;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Check if stable ID user already exists
        const existingStableUser = await tx.user.findUnique({
          where: { id: stableId },
        });

        if (existingStableUser) {
          // Merge data into existing stable user
          console.log(`  Merging into existing stable user ${stableId}`);

          // Check for Stripe customer ID conflicts
          if (user.stripeCustomerId && existingStableUser.stripeCustomerId) {
            if (user.stripeCustomerId !== existingStableUser.stripeCustomerId) {
              const warning =
                `Stripe customer ID conflict for ${user.email}: ` +
                `old=${user.stripeCustomerId}, stable=${existingStableUser.stripeCustomerId}. ` +
                `Keeping stable user's Stripe ID.`;
              console.warn(`  WARNING: ${warning}`);
              stats.warnings.push(warning);
            }
          } else if (user.stripeCustomerId && !existingStableUser.stripeCustomerId) {
            // Migrate Stripe customer ID to stable user
            await tx.user.update({
              where: { id: stableId },
              data: { stripeCustomerId: user.stripeCustomerId },
            });
            stats.stripeIdsMigrated++;
            console.log(`  Migrated Stripe customer ID to stable user`);
          }

          // Update enhanced images to use stable ID
          const imageResult = await tx.enhancedImage.updateMany({
            where: { userId: user.id },
            data: { userId: stableId },
          });
          stats.imagesMigrated += imageResult.count;

          // Update enhancement jobs to use stable ID
          const jobResult = await tx.imageEnhancementJob.updateMany({
            where: { userId: user.id },
            data: { userId: stableId },
          });
          stats.jobsMigrated += jobResult.count;

          // Merge token balances using atomic increment for safety
          if (user.tokenBalance) {
            const existingBalance = await tx.userTokenBalance.findUnique({
              where: { userId: stableId },
            });
            if (existingBalance) {
              // Use atomic increment to safely add balances
              await tx.userTokenBalance.update({
                where: { userId: stableId },
                data: {
                  balance: {
                    increment: user.tokenBalance.balance,
                  },
                },
              });
              // Delete old record after incrementing
              await tx.userTokenBalance.delete({
                where: { userId: user.id },
              });
            } else {
              await tx.userTokenBalance.update({
                where: { userId: user.id },
                data: { userId: stableId },
              });
            }
            stats.tokenBalancesMigrated++;
          }

          // Update token transactions to use stable ID
          const txResult = await tx.tokenTransaction.updateMany({
            where: { userId: user.id },
            data: { userId: stableId },
          });
          stats.tokenTransactionsMigrated += txResult.count;

          // Update albums to use stable ID
          const albumResult = await tx.album.updateMany({
            where: { userId: user.id },
            data: { userId: stableId },
          });
          stats.albumsMigrated += albumResult.count;

          // Delete the old user
          await tx.user.delete({
            where: { id: user.id },
          });
        } else {
          // Create new user with stable ID and migrate all data
          await tx.user.create({
            data: {
              id: stableId,
              name: user.name,
              email: user.email,
              emailVerified: user.emailVerified,
              image: user.image,
              stripeCustomerId: user.stripeCustomerId,
            },
          });

          // Update all related records to use new stable ID
          const imageResult = await tx.enhancedImage.updateMany({
            where: { userId: user.id },
            data: { userId: stableId },
          });
          stats.imagesMigrated += imageResult.count;

          const jobResult = await tx.imageEnhancementJob.updateMany({
            where: { userId: user.id },
            data: { userId: stableId },
          });
          stats.jobsMigrated += jobResult.count;

          if (user.tokenBalance) {
            await tx.userTokenBalance.update({
              where: { userId: user.id },
              data: { userId: stableId },
            });
            stats.tokenBalancesMigrated++;
          }

          const txResult = await tx.tokenTransaction.updateMany({
            where: { userId: user.id },
            data: { userId: stableId },
          });
          stats.tokenTransactionsMigrated += txResult.count;

          const albumResult = await tx.album.updateMany({
            where: { userId: user.id },
            data: { userId: stableId },
          });
          stats.albumsMigrated += albumResult.count;

          // Delete the old user
          await tx.user.delete({
            where: { id: user.id },
          });
        }

        stats.usersMigrated++;
      });

      console.log(`  Successfully migrated user ${user.email}`);
    } catch (error) {
      const errorMsg = `Failed to migrate user ${user.email}: ${error}`;
      console.error(`  ${errorMsg}`);
      stats.errors.push(errorMsg);
    }
  }

  return stats;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  console.log("=".repeat(60));
  console.log("User Migration to Stable Email-Based IDs");
  if (dryRun) {
    console.log("MODE: DRY RUN (preview only)");
  }
  console.log("=".repeat(60));

  // Check for salt (USER_ID_SALT or AUTH_SECRET)
  const salt = process.env.USER_ID_SALT || process.env.AUTH_SECRET;
  if (!salt) {
    console.error("\nERROR: Neither USER_ID_SALT nor AUTH_SECRET environment variable is set!");
    console.error("This is required to generate stable user IDs that match the application.");
    console.error("\nSet one using:");
    console.error("  export USER_ID_SALT=<your-user-id-salt>  # Preferred (never rotate)");
    console.error("  export AUTH_SECRET=<your-auth-secret>   # Fallback");
    process.exit(1);
  }
  console.log(`Using salt from: ${process.env.USER_ID_SALT ? "USER_ID_SALT" : "AUTH_SECRET"}`);

  // Check for active sessions (migration lock)
  const canProceed = await checkNoActiveSessions(force);
  if (!canProceed) {
    process.exit(1);
  }

  const stats = await migrateUsers(dryRun);

  console.log("\n" + "=".repeat(60));
  console.log("Migration Complete");
  console.log("=".repeat(60));
  console.log(`Users processed: ${stats.usersProcessed}`);
  console.log(`Users migrated: ${stats.usersMigrated}`);
  console.log(`Images migrated: ${stats.imagesMigrated}`);
  console.log(`Jobs migrated: ${stats.jobsMigrated}`);
  console.log(`Token balances migrated: ${stats.tokenBalancesMigrated}`);
  console.log(`Token transactions migrated: ${stats.tokenTransactionsMigrated}`);
  console.log(`Albums migrated: ${stats.albumsMigrated}`);
  console.log(`Stripe customer IDs migrated: ${stats.stripeIdsMigrated}`);

  if (stats.warnings.length > 0) {
    console.log(`\nWarnings (${stats.warnings.length}):`);
    stats.warnings.forEach((warn) => console.log(`  - ${warn}`));
  }

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    stats.errors.forEach((err) => console.log(`  - ${err}`));
  }
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

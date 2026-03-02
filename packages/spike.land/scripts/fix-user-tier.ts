/**
 * Script to manually fix a user's tier after webhook failure
 *
 * Usage:
 *   npx tsx scripts/fix-user-tier.ts <user_email> <tier>
 *
 * Examples:
 *   npx tsx scripts/fix-user-tier.ts user@example.com BASIC
 *   npx tsx scripts/fix-user-tier.ts user@example.com STANDARD
 *   npx tsx scripts/fix-user-tier.ts user@example.com PREMIUM
 */

import type { SubscriptionTier } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TIER_WELL_CAPACITY: Record<SubscriptionTier, number> = {
  FREE: 100,
  BASIC: 200,
  STANDARD: 500,
  PREMIUM: 1000,
};

async function main() {
  const [, , email, tierArg] = process.argv;

  if (!email || !tierArg) {
    console.error("Usage: npx tsx scripts/fix-user-tier.ts <email> <tier>");
    console.error("Example: npx tsx scripts/fix-user-tier.ts user@example.com BASIC");
    process.exit(1);
  }

  const validTiers = ["FREE", "BASIC", "STANDARD", "PREMIUM"] as const;
  if (!validTiers.includes(tierArg as (typeof validTiers)[number])) {
    console.error(`Invalid tier: ${tierArg}`);
    console.error(`Valid tiers: ${validTiers.join(", ")}`);
    process.exit(1);
  }

  const tier = tierArg as SubscriptionTier;
  const wellCapacity = TIER_WELL_CAPACITY[tier];

  console.log(`\nLooking up user: ${email}`);

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      subscription: true,
      tokenBalance: true,
    },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(`Found user: ${user.id} (${user.name || "no name"})`);
  console.log(`Current tier: ${user.tokenBalance?.tier || "FREE"}`);
  console.log(`Current balance: ${user.tokenBalance?.balance || 0}`);
  console.log(`Current subscription: ${user.subscription?.status || "none"}`);

  console.log(`\nUpdating to tier: ${tier} (well capacity: ${wellCapacity})`);

  // Update token balance with new tier
  await prisma.userTokenBalance.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      balance: wellCapacity, // Start with full well capacity
      tier,
      lastRegeneration: new Date(),
    },
    update: {
      tier,
    },
  });

  // If there's a subscription, update its tier too
  if (user.subscription) {
    await prisma.subscription.update({
      where: { id: user.subscription.id },
      data: {
        tier,
        status: "ACTIVE",
      },
    });
    console.log("Updated subscription tier to:", tier);
  }

  // Record the manual fix as a transaction
  const updatedBalance = await prisma.userTokenBalance.findUnique({
    where: { userId: user.id },
  });

  await prisma.tokenTransaction.create({
    data: {
      userId: user.id,
      amount: 0,
      type: "EARN_PURCHASE",
      source: "manual_tier_fix",
      sourceId: `manual-fix-${Date.now()}`,
      balanceAfter: updatedBalance?.balance || 0,
      metadata: {
        tier,
        previousTier: user.tokenBalance?.tier || "FREE",
        reason: "Webhook failed, manual fix applied",
        fixedAt: new Date().toISOString(),
      },
    },
  });

  console.log("\n✅ Tier updated successfully!");
  console.log(`User ${email} is now on ${tier} tier with well capacity ${wellCapacity}`);

  // Verify the update
  const finalUser = await prisma.user.findUnique({
    where: { email },
    include: {
      subscription: true,
      tokenBalance: true,
    },
  });

  console.log("\nFinal state:");
  console.log(`  Tier: ${finalUser?.tokenBalance?.tier}`);
  console.log(`  Balance: ${finalUser?.tokenBalance?.balance}`);
  console.log(`  Subscription status: ${finalUser?.subscription?.status || "none"}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

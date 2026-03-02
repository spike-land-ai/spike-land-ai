/**
 * Script to manually credit tokens to a user after webhook failure
 *
 * Usage:
 *   npx tsx scripts/fix-user-tokens.ts <user_email> <token_amount>
 *
 * Examples:
 *   npx tsx scripts/fix-user-tokens.ts user@example.com 10
 *   npx tsx scripts/fix-user-tokens.ts user@example.com 50
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [, , email, tokensArg] = process.argv;

  if (!email || !tokensArg) {
    console.error("Usage: npx tsx scripts/fix-user-tokens.ts <email> <tokens>");
    console.error("Example: npx tsx scripts/fix-user-tokens.ts user@example.com 10");
    process.exit(1);
  }

  const tokenAmount = parseInt(tokensArg, 10);
  if (isNaN(tokenAmount) || tokenAmount <= 0) {
    console.error(`Invalid token amount: ${tokensArg}`);
    process.exit(1);
  }

  console.log(`\nLooking up user: ${email}`);

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tokenBalance: true,
    },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  console.log(`Found user: ${user.id} (${user.name || "no name"})`);
  console.log(`Current balance: ${user.tokenBalance?.balance || 0}`);

  console.log(`\nCrediting ${tokenAmount} tokens...`);

  // Get or create token balance
  const currentBalance = user.tokenBalance?.balance || 0;
  const newBalance = currentBalance + tokenAmount;

  // Update token balance (purchased tokens have no cap)
  await prisma.userTokenBalance.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      balance: tokenAmount,
      tier: "FREE",
      lastRegeneration: new Date(),
    },
    update: {
      balance: newBalance,
    },
  });

  // Record the manual fix as a transaction
  await prisma.tokenTransaction.create({
    data: {
      userId: user.id,
      amount: tokenAmount,
      type: "EARN_PURCHASE",
      source: "manual_token_fix",
      sourceId: `manual-fix-${Date.now()}`,
      balanceAfter: newBalance,
      metadata: {
        reason: "Webhook failed, manual token credit applied",
        fixedAt: new Date().toISOString(),
      },
    },
  });

  console.log("\n✅ Tokens credited successfully!");
  console.log(`User ${email} now has ${newBalance} tokens (was ${currentBalance})`);

  // Verify the update
  const finalBalance = await prisma.userTokenBalance.findUnique({
    where: { userId: user.id },
  });

  console.log("\nFinal state:");
  console.log(`  Balance: ${finalBalance?.balance}`);
  console.log(`  Tier: ${finalBalance?.tier}`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

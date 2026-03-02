import { encryptToken, isEncrypted } from "../src/lib/crypto/token-encryption";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backfill() {
  console.log("Starting credential backfill...");

  // 1. AIProvider
  const providers = await prisma.aIProvider.findMany({
    where: {
      token: { not: null },
      tokenEncrypted: null,
    },
  });

  console.log(`Backfilling ${providers.length} AI providers...`);
  for (const p of providers) {
    if (p.token && !isEncrypted(p.token)) {
      await prisma.aIProvider.update({
        where: { id: p.id },
        data: {
          tokenEncrypted: encryptToken(p.token),
          token: null,
        },
      });
    }
  }

  // 2. MarketingAccount
  const accounts = await prisma.marketingAccount.findMany({
    where: {
      OR: [
        { accessToken: { not: null }, accessTokenEncrypted: null },
        { refreshToken: { not: null }, refreshTokenEncrypted: null },
      ],
    },
  });

  console.log(`Backfilling ${accounts.length} marketing accounts...`);
  for (const a of accounts) {
    const updateData: {
      accessTokenEncrypted?: string;
      accessToken?: null;
      refreshTokenEncrypted?: string;
      refreshToken?: null;
    } = {};
    if (a.accessToken && !isEncrypted(a.accessToken)) {
      updateData.accessTokenEncrypted = encryptToken(a.accessToken);
      updateData.accessToken = null;
    }
    if (a.refreshToken && !isEncrypted(a.refreshToken)) {
      updateData.refreshTokenEncrypted = encryptToken(a.refreshToken);
      updateData.refreshToken = null;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.marketingAccount.update({
        where: { id: a.id },
        data: updateData,
      });
    }
  }

  console.log("Backfill complete.");
}

backfill()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

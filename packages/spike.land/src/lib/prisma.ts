import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "@/lib/logger";

const prismaClientSingleton = () => {
  const rawConnectionString = process.env.DATABASE_URL;

  if (!rawConnectionString) {
    // If we're in a build environment (like Vercel) or E2E test context,
    // the DB might not be available. Instead of throwing, we'll return a mock client.
    // This allows the build/tests to succeed. If any code *actually* tries to query
    // the DB, it will fail, which is the desired behavior.
    const isBuild = process.env.NEXT_PHASE === "phase-production-build";
    const isE2ETestContext =
      process.env.CI === "true" && process.env.BASE_URL && !rawConnectionString;

    if (isBuild || isE2ETestContext) {
      if (isBuild) {
        logger.warn("DATABASE_URL not available during build. Using mocked Prisma Client.");
      }
      return new Proxy(
        {},
        {
          get: (_, prop) => {
            // This proxy will throw an error if any prisma method is called.
            throw new Error(
              `Attempted to access Prisma without DATABASE_URL (property: ${String(
                prop,
              )}). Please ensure DATABASE_URL is set.`,
            );
          },
        },
      ) as PrismaClient;
    }

    throw new Error(
      "DATABASE_URL environment variable is required for database access. " +
        "Please ensure it is set in your environment.",
    );
  }

  // Rewrite sslmode=require → sslmode=verify-full to suppress pg v9 deprecation warning
  const connectionString = rawConnectionString.replace(/sslmode=require\b/, "sslmode=verify-full");

  const adapter = new PrismaPg({
    connectionString,
    // Serverless-friendly pool settings:
    // - Higher connection timeout for cold starts
    // - Low max connections to avoid pool exhaustion across instances
    // - Idle timeout to release unused connections
    connectionTimeoutMillis: 15_000,
    max: 5,
    idleTimeoutMillis: 30_000,
    ssl: process.env.NODE_ENV === "production" ? true : undefined,
  });
  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
};

declare const globalThis: {
  prismaGlobal_LearnIt: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal_LearnIt ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal_LearnIt = prisma;
}

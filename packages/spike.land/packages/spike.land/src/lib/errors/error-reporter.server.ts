/**
 * Server-only Error Reporter Functions
 *
 * These functions require Prisma and should only be imported from server code
 * (API routes, server actions, etc.)
 */

import "server-only";
import prisma from "@/lib/prisma";

interface PendingError {
  message: string;
  stack?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
  callerName?: string;
  errorType?: string;
  errorCode?: string;
  route?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Report multiple errors to database in a single batch INSERT.
 * Uses Prisma's createMany for efficient bulk inserts.
 */
export async function reportErrorsBatchToDatabase(
  errors: Array<{ error: PendingError; environment: "FRONTEND" | "BACKEND"; }>,
): Promise<void> {
  if (errors.length === 0) return;

  await prisma.errorLog.createMany({
    data: errors.map(({ error, environment }) => ({
      message: error.message,
      stack: error.stack,
      sourceFile: error.sourceFile,
      sourceLine: error.sourceLine,
      sourceColumn: error.sourceColumn,
      callerName: error.callerName,
      errorType: error.errorType,
      errorCode: error.errorCode,
      route: error.route,
      userId: error.userId,
      environment,
      metadata: error.metadata
        ? JSON.parse(JSON.stringify(error.metadata))
        : null,
      timestamp: error.timestamp ? new Date(error.timestamp) : new Date(),
    })),
  });
}

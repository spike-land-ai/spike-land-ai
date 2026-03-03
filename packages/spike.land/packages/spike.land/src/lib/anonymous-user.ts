import { logger } from "@/lib/errors/structured-logger";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";

/**
 * System anonymous user configuration.
 * This user is used for anonymous image uploads and mix jobs.
 */
const ANONYMOUS_USER_ID = "anonymous-system-user";
const ANONYMOUS_USER_EMAIL = "anonymous@system.spike.land";
const ANONYMOUS_USER_NAME = "Anonymous User";

/**
 * Gets or creates the system anonymous user.
 * This user is used as the owner for images and jobs created by
 * non-logged-in users.
 *
 * @returns The anonymous user ID
 * @throws Error if the anonymous user cannot be created
 */
export async function getOrCreateAnonymousUser(): Promise<string> {
  const { data: user, error } = await tryCatch(
    prisma.user.upsert({
      where: { id: ANONYMOUS_USER_ID },
      update: {},
      create: {
        id: ANONYMOUS_USER_ID,
        email: ANONYMOUS_USER_EMAIL,
        name: ANONYMOUS_USER_NAME,
      },
    }),
  );

  if (error || !user) {
    logger.error(
      "Failed to get or create anonymous user",
      error instanceof Error ? error : new Error("Unknown error"),
    );
    throw new Error("Anonymous user initialization failed");
  }

  return user.id;
}

/**
 * The ID of the system anonymous user.
 * Use getOrCreateAnonymousUser() to ensure the user exists.
 */
export const ANONYMOUS_USER_ID_CONST = ANONYMOUS_USER_ID;

/**
 * Checks if a user ID belongs to the anonymous user.
 */
export function isAnonymousUserId(userId: string): boolean {
  return userId === ANONYMOUS_USER_ID;
}

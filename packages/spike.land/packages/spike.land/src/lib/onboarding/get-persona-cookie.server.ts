/**
 * Server-only persona cookie reader (App Router).
 *
 * This file imports `next/headers` which can only be used in Server Components.
 * For client-side cookie access, use `get-persona-cookie.ts` instead.
 */

import { cookies } from "next/headers";

const COOKIE_NAME = "spike-persona";

/**
 * Read the persona cookie on the server (App Router only).
 * Returns the persona slug or null if not set.
 */
export async function getPersonaCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}

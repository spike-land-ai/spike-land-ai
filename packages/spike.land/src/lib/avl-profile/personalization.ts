/**
 * App Store Personalization based on AVL User Profiles
 *
 * Filters store apps based on a user's AVL profile tree answers.
 */

import type { StoreApp } from "@/app/store/data/store-apps";
import type { AnswerPathEntry } from "./types";

/**
 * Returns store apps filtered based on the user's AVL profile.
 * If the user has no profile, all apps are returned unfiltered.
 */
export async function getPersonalizedApps(userId: string): Promise<StoreApp[]> {
  const prisma = (await import("@/lib/prisma")).default;
  const { STORE_APPS } = await import("@/app/store/data/store-apps");

  const profile = await prisma.avlUserProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return STORE_APPS;
  }

  const tags = profile.derivedTags;

  return STORE_APPS.filter((app) => {
    if (app.category === "developer" && !tags.includes("developer")) {
      return false;
    }
    return true;
  });
}

/**
 * Derives tags from an answer path by collecting questionTags
 * from entries where the user answered "yes".
 */
export function deriveTagsFromAnswerPath(answerPath: AnswerPathEntry[]): string[] {
  const tagSet = new Set<string>();

  for (const entry of answerPath) {
    if (entry.answer === true) {
      for (const tag of entry.questionTags) {
        tagSet.add(tag);
      }
    }
  }

  return [...tagSet].sort();
}

/**
 * Builds a profile vector mapping each tag to 1.0 if the user answered "yes"
 * to a question associated with that tag, or 0.0 otherwise.
 */
export function buildProfileVector(
  answerPath: AnswerPathEntry[],
  allTags: string[],
): Record<string, number> {
  const vector: Record<string, number> = {};

  const yesTags = new Set<string>();
  for (const entry of answerPath) {
    if (entry.answer === true) {
      for (const tag of entry.questionTags) {
        yesTags.add(tag);
      }
    }
  }

  for (const tag of allTags) {
    vector[tag] = yesTags.has(tag) ? 1.0 : 0.0;
  }

  return vector;
}

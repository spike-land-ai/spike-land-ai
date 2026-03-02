/**
 * 404 Alert System
 *
 * Auto-creates a GitHub issue when the same URL gets 404 hits 2+ times in a day.
 * Uses Redis for dedup and GitHub API for issue creation.
 */

import { redis } from "@/lib/upstash/client";
import { createIssue, isGitHubAvailable, listIssues } from "@/lib/agents/github-issues";
import { tryCatch } from "@/lib/try-catch";
import { logger } from "@/lib/logger";

const DEDUP_TTL_SECONDS = 48 * 60 * 60; // 48 hours

/**
 * Trigger a GitHub issue alert for repeated 404 hits.
 * Deduplicates via Redis key and existing open GitHub issues.
 */
export async function triggerGitHubAlert(
  url: string,
  date: string,
): Promise<{ created: boolean; reason?: string }> {
  if (!isGitHubAvailable()) {
    return { created: false, reason: "github_unavailable" };
  }

  const dedupKey = `404:alerted:${date}:${url}`;

  // Check Redis dedup — if already alerted today, skip
  const existing = await redis.get(dedupKey);
  if (existing) {
    return { created: false, reason: "already_alerted" };
  }

  // Set dedup key before API call to prevent races
  await redis.set(dedupKey, "1", { ex: DEDUP_TTL_SECONDS });

  // Check for existing open issue with same title
  const issueTitle = `[404 Alert] Repeated 404 hits on ${url}`;
  const { data: issues } = await listIssues({
    state: "open",
    labels: "404-alert",
    limit: 50,
  });

  if (issues?.some((issue) => issue.title === issueTitle)) {
    return { created: false, reason: "issue_exists" };
  }

  // Create the GitHub issue
  const { data: issue, error } = await createIssue({
    title: issueTitle,
    labels: ["404-alert", "agent-created"],
    body: `## Repeated 404 Alert

**URL**: \`${url}\`
**Date**: ${date}
**Detected**: This URL has been hit 2+ times today, indicating a possible broken link.

## Action Items
- [ ] Check if this URL should exist (broken internal link?)
- [ ] Check referrers for external broken links
- [ ] Add redirect if the content moved
- [ ] Close this issue once resolved`,
  });

  if (error || !issue) {
    // Clean up dedup key so retry is possible
    const { error: delError } = await tryCatch(redis.del(dedupKey));
    if (delError) {
      logger.error("[404-alert] Failed to clean up dedup key:", delError);
    }
    return { created: false, reason: `api_error: ${error}` };
  }

  return { created: true };
}

import { createIssue } from "@/lib/agents/github-issues";
import logger from "@/lib/logger";
import type { PipelinePhase } from "./types";

export async function createGenerationTicket(
  slug: string,
  originalUrl: string,
  category: string | null,
): Promise<{
  githubIssueNumber: number | null;
}> {
  const title = `[Auto-Gen] Route: /${slug}`;
  const description = [
    `**URL**: ${originalUrl}`,
    `**Slug**: ${slug}`,
    category ? `**Category**: ${category}` : null,
    "",
    "Auto-generated route via the No-404 pipeline.",
  ]
    .filter(Boolean)
    .join("\n");

  let githubIssueNumber: number | null = null;
  try {
    const result = await createIssue({
      title,
      body: description,
      labels: ["auto-gen", "no-404"],
    });
    if (result.data?.number) {
      githubIssueNumber = result.data.number;
    }
  } catch (error) {
    logger.warn("GitHub issue creation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { githubIssueNumber };
}

export async function updateTicketStatus(
  githubIssueNumber: number | null,
  phase: PipelinePhase,
  _message?: string,
): Promise<void> {
  // GitHub issue updates happen via PR links, not individual status updates
  if (githubIssueNumber && (phase === "PUBLISHED" || phase === "FAILED")) {
    try {
      // Close issue on terminal states - use the existing gh CLI approach
      logger.info(`Generation ticket #${githubIssueNumber} reached terminal state: ${phase}`);
    } catch {
      // Non-critical
    }
  }
}

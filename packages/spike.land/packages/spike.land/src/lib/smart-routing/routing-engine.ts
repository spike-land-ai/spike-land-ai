import prisma from "@/lib/prisma";
import { analyzeMessage } from "./analyze-message";
import { EscalationService } from "./escalation-service";
import { calculatePriorityScore } from "./priority-calculator";
import { getSmartRoutingSettings } from "./settings";
import { logger } from "@/lib/logger";

export class RoutingEngine {
  /*
   * Main entry point to process an inbox item.
   * 1. Check if analysis needed
   * 2. Run analysis
   * 3. Calculate priority
   * 4. Save results
   * 5. Check auto-escalation rules
   */
  static async processItem(itemId: string, workspaceId: string) {
    const item = await prisma.inboxItem.findUnique({
      where: { id: itemId },
    });
    if (!item) return;

    const settings = await getSmartRoutingSettings(workspaceId);
    if (!settings.enabled) return;

    // 1. Analysis
    // We only analyze if content is present and not already analyzed
    if (!item.routingAnalyzedAt && item.content) {
      try {
        const analysis = await analyzeMessage({
          content: item.content,
          senderName: item.senderName,
          senderHandle: item.senderHandle || undefined,
          platform: item.platform,
        });

        // 2. Priority
        const { score, factors } = calculatePriorityScore({
          analysis,
          item,
          senderFollowers: (item.metadata as Record<string, unknown>)
            ?.followers_count as number
            || 0,
          settings,
        });

        // 3. Save Analysis & Priority
        await prisma.inboxItem.update({
          where: { id: itemId },
          data: {
            routingAnalyzedAt: new Date(),
            sentiment: analysis.sentiment,
            sentimentScore: analysis.sentimentScore, // Prisma Float
            priorityScore: score,
            priorityFactors: factors,
            routingMetadata: {
              urgency: analysis.urgency,
              category: analysis.category,
              intent: analysis.intent,
              reasoning: analysis.reasoning,
            },
          },
        });

        // 4. Store Suggested Responses
        if (analysis.suggestedResponses?.length) {
          await prisma.inboxSuggestedResponse.createMany({
            data: analysis.suggestedResponses.map(content => ({
              inboxItemId: itemId,
              content,
              confidenceScore: 0.8, // Gemini doesn't give this per suggestion yet
              tone: "professional",
              category: "auto-generated",
            })),
          });
        }

        // 5. Auto-Escalation Check
        // If sentiment is very negative or urgency is critical
        if (
          analysis.sentimentScore <= settings.negativeSentimentThreshold
          || analysis.urgency === "critical"
        ) {
          const escalationService = new EscalationService(workspaceId);
          await escalationService.escalateItem(
            itemId,
            "SENTIMENT", // or RULE
            `Auto-escalated due to negative sentiment (${analysis.sentimentScore}) or critical urgency`,
          );
        }
      } catch (error) {
        logger.error(
          `Failed to process smart routing for item ${itemId}`,
          error,
        );
      }
    }
  }
}

/**
 * Reports MCP Tools
 *
 * System report generation with aggregated platform metrics.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const REPORT_SECTIONS = [
  "platform",
  "users",
  "tokens",
  "health",
  "marketing",
  "errors",
  "meta",
] as const;

const GenerateSystemReportSchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).optional().default("30d").describe(
    "Report period.",
  ),
  sections: z.array(z.enum(REPORT_SECTIONS)).optional().describe(
    "Sections to include (default: all).",
  ),
  format: z.enum(["json", "markdown"]).optional().default("markdown").describe(
    "Output format.",
  ),
});

export function registerReportsTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "reports_generate_system",
    description: "Generate a system report with aggregated platform metrics.",
    category: "reports",
    tier: "free",
    inputSchema: GenerateSystemReportSchema.shape,
    handler: async ({
      period = "30d",
      sections,
      format = "markdown",
    }: z.infer<typeof GenerateSystemReportSchema>): Promise<CallToolResult> =>
      safeToolCall("reports_generate_system", async () => {
        const {
          generateSystemReport,
          generateSystemReportSummary,
        } = await import("@/lib/reports/system-report");
        type ReportSection = (typeof REPORT_SECTIONS)[number];

        if (format === "json") {
          const report = sections
            ? await generateSystemReport(period, sections as ReportSection[])
            : await generateSystemReport(period);
          return textResult(JSON.stringify(report, null, 2));
        }

        // Markdown format: use summary for a concise overview
        const summary = await generateSystemReportSummary(period);
        const h = summary.highlights;

        let text = `# System Report\n\n`
          + `**Generated:** ${summary.generatedAt}\n`
          + `**Period:** ${summary.period.start} to ${summary.period.end}\n\n`
          + `## Highlights\n\n`
          + `| Metric | Value |\n`
          + `|--------|-------|\n`
          + `| Total Users | ${h.totalUsers} |\n`
          + `| Active Users (7d) | ${h.activeUsersLast7Days} |\n`
          + `| Total Enhancements | ${h.totalEnhancements} |\n`
          + `| Pending Jobs | ${h.pendingJobs} |\n`
          + `| Failed Jobs | ${h.failedJobs} |\n`
          + `| AI Credits Used | ${h.totalAiCreditsUsed} |\n`
          + `| Errors (24h) | ${h.errorsLast24Hours} |\n`
          + `| Conversion Rate | ${(h.conversionRate * 100).toFixed(1)}% |\n`;

        if (summary.external) {
          text += `\n## External\n\n`;
          if (summary.external.metaTotalSpend !== undefined) {
            text += `- **Meta Ads Spend:** $${summary.external.metaTotalSpend.toFixed(2)}\n`;
          }
        }

        return textResult(text);
      }),
  });
}

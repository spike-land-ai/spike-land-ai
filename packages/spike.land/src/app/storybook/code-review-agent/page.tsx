"use client";

import {
  AccessibilityPanel,
  Breadcrumbs,
  CodePreview,
  ComponentSample,
  PageHeader,
  RelatedComponents,
  UsageGuide,
} from "@/components/storybook";
import { ComplexityBadge } from "@/components/code-review-agent/ComplexityBadge";
import { ReviewIssueRow } from "@/components/code-review-agent/ReviewIssueRow";
import { ReviewSummaryCard } from "@/components/code-review-agent/ReviewSummaryCard";
import { ReviewRulesPanel } from "@/components/code-review-agent/ReviewRulesPanel";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockIssues = [
  {
    severity: "error" as const,
    filePath: "src/lib/auth/session.ts",
    lineNumber: 42,
    message: "Unhandled promise rejection: missing try/catch around async call",
    ruleId: "no-unhandled-promise",
  },
  {
    severity: "error" as const,
    filePath: "src/app/api/users/route.ts",
    lineNumber: 17,
    message: "SQL injection risk: user input interpolated directly into query string",
    ruleId: "no-sql-injection",
  },
  {
    severity: "warning" as const,
    filePath: "src/components/ui/Button.tsx",
    lineNumber: 88,
    message: "Component re-renders on every parent update — consider React.memo",
    ruleId: "react/no-unnecessary-rerender",
  },
  {
    severity: "warning" as const,
    filePath: "src/lib/stripe/webhooks.ts",
    lineNumber: 203,
    message: "Deprecated API method `charges.create` — migrate to PaymentIntents",
    ruleId: "no-deprecated-api",
  },
  {
    severity: "info" as const,
    filePath: "src/hooks/useLocalStorage.ts",
    lineNumber: 11,
    message: "Consider adding error boundary for SSR-safe localStorage access",
    ruleId: "ssr-safe-storage",
  },
  {
    severity: "suggestion" as const,
    filePath: "src/lib/mcp/server/tools/chess/tournament.ts",
    message: "Extract repeated ELO calculation logic into a shared utility function",
    ruleId: "prefer-shared-utils",
  },
];

const mockRules = [
  {
    id: "no-unhandled-promise",
    name: "No Unhandled Promises",
    category: "reliability",
    enabled: true,
    description: "All async calls must be wrapped in try/catch or have .catch() handlers.",
    severity: "error" as const,
  },
  {
    id: "no-sql-injection",
    name: "SQL Injection Prevention",
    category: "security",
    enabled: true,
    description: "User input must be sanitized or parameterized before being used in queries.",
    severity: "error" as const,
  },
  {
    id: "react/no-unnecessary-rerender",
    name: "Avoid Unnecessary Re-renders",
    category: "performance",
    enabled: true,
    description:
      "Components that receive stable props should be memoized to prevent wasteful re-renders.",
    severity: "warning" as const,
  },
  {
    id: "no-deprecated-api",
    name: "No Deprecated APIs",
    category: "maintainability",
    enabled: true,
    description: "Usage of deprecated library methods must be migrated to current alternatives.",
    severity: "warning" as const,
  },
  {
    id: "ssr-safe-storage",
    name: "SSR-Safe Browser APIs",
    category: "compatibility",
    enabled: false,
    description: "Browser-only APIs (localStorage, window) must be guarded against SSR execution.",
    severity: "info" as const,
  },
  {
    id: "prefer-shared-utils",
    name: "Prefer Shared Utilities",
    category: "maintainability",
    enabled: false,
    description: "Repeated logic patterns should be extracted into shared utility modules.",
    severity: "info" as const,
  },
];

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

const codeSnippets = {
  complexityBadge:
    `import { ComplexityBadge } from "@/components/code-review-agent/ComplexityBadge";

<ComplexityBadge level="low" />
<ComplexityBadge level="medium" />
<ComplexityBadge level="high" />
<ComplexityBadge level="critical" />`,

  reviewIssueRow: `import { ReviewIssueRow } from "@/components/code-review-agent/ReviewIssueRow";

<ReviewIssueRow
  severity="error"
  filePath="src/lib/auth/session.ts"
  lineNumber={42}
  message="Unhandled promise rejection: missing try/catch around async call"
  ruleId="no-unhandled-promise"
/>`,

  reviewSummaryCard:
    `import { ReviewSummaryCard } from "@/components/code-review-agent/ReviewSummaryCard";

<ReviewSummaryCard
  score={74}
  issuesFound={6}
  errors={2}
  warnings={2}
  suggestions={1}
  filesReviewed={12}
  linesReviewed={1840}
  complexity="medium"
/>`,

  reviewRulesPanel:
    `import { ReviewRulesPanel } from "@/components/code-review-agent/ReviewRulesPanel";

<ReviewRulesPanel
  rules={[
    {
      id: "no-unhandled-promise",
      name: "No Unhandled Promises",
      category: "reliability",
      enabled: true,
      description: "All async calls must be wrapped in try/catch.",
      severity: "error",
    },
    // ...more rules
  ]}
/>`,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CodeReviewAgentPage() {
  return (
    <div className="space-y-16 pb-20">
      <Breadcrumbs />

      <PageHeader
        title="Code Review Agent"
        description="The Code Review Agent provides automated static analysis, rule enforcement, and quality scoring for submitted code. It surfaces errors, warnings, and suggestions organized by severity and file location."
        usage="Use these components to display review results, rule configurations, and code quality metrics. Pair ReviewSummaryCard with ReviewIssueRow lists for full review dashboards."
      />

      <UsageGuide
        dos={[
          "Show ReviewSummaryCard at the top of review results to give an at-a-glance quality score.",
          "Group ReviewIssueRow entries by severity — errors first, then warnings, then info and suggestions.",
          "Use ComplexityBadge alongside score displays to communicate structural complexity.",
          "Display ReviewRulesPanel to let users understand which rules are active for a given review.",
          "Use ruleId in ReviewIssueRow to link issues back to specific rule documentation.",
        ]}
        donts={[
          "Don't show ReviewSummaryCard without the full issue list — users need context for the score.",
          "Avoid displaying more than 20 issues at once without pagination or filtering.",
          "Don't hide the severity icon — color alone is not sufficient for accessibility.",
          "Avoid using ReviewRulesPanel with interactive toggles in read-only review contexts.",
          "Don't omit the filePath — users need to know where each issue was found.",
        ]}
      />

      {/* Complexity Badges */}
      <ComponentSample
        title="Complexity Badge"
        description="Colored badges indicating the structural complexity level of reviewed code. Maps to four levels: low (green), medium (yellow), high (orange), and critical (red)."
        code={codeSnippets.complexityBadge}
        importPath='import { ComplexityBadge } from "@/components/code-review-agent/ComplexityBadge"'
      >
        <div className="flex flex-wrap gap-3 items-center justify-center">
          <ComplexityBadge level="low" />
          <ComplexityBadge level="medium" />
          <ComplexityBadge level="high" />
          <ComplexityBadge level="critical" />
        </div>
      </ComponentSample>

      {/* Review Summary Cards */}
      <ComponentSample
        title="Review Summary Card"
        description="Overall quality score card with issue breakdown, file/line counts, and complexity indicator. Score ring changes color based on quality thresholds: green (80+), yellow (60-79), orange (40-59), red (below 40)."
        code={codeSnippets.reviewSummaryCard}
        importPath='import { ReviewSummaryCard } from "@/components/code-review-agent/ReviewSummaryCard"'
      >
        <div className="flex flex-wrap gap-6 justify-center w-full">
          <ReviewSummaryCard
            score={92}
            issuesFound={2}
            errors={0}
            warnings={1}
            suggestions={1}
            filesReviewed={8}
            linesReviewed={640}
            complexity="low"
          />
          <ReviewSummaryCard
            score={74}
            issuesFound={6}
            errors={2}
            warnings={2}
            suggestions={1}
            filesReviewed={12}
            linesReviewed={1840}
            complexity="medium"
          />
          <ReviewSummaryCard
            score={38}
            issuesFound={14}
            errors={6}
            warnings={5}
            suggestions={2}
            filesReviewed={22}
            linesReviewed={4200}
            complexity="critical"
          />
        </div>
      </ComponentSample>

      {/* Review Issue Rows */}
      <ComponentSample
        title="Review Issue Rows"
        description="Individual issue rows showing severity icon, colored severity badge, file path with optional line number, human-readable message, and optional rule ID. Supports four severity levels: error, warning, info, suggestion."
        code={codeSnippets.reviewIssueRow}
        importPath='import { ReviewIssueRow } from "@/components/code-review-agent/ReviewIssueRow"'
      >
        <div className="space-y-2 w-full max-w-2xl">
          {mockIssues.map((issue, i) => (
            <ReviewIssueRow
              key={i}
              severity={issue.severity}
              filePath={issue.filePath}
              {...(issue.lineNumber !== undefined ? { lineNumber: issue.lineNumber } : {})}
              message={issue.message}
              ruleId={issue.ruleId}
            />
          ))}
        </div>
      </ComponentSample>

      {/* Review Rules Panel */}
      <ComponentSample
        title="Review Rules Panel"
        description="List of configured review rules showing name, category, severity, enabled/disabled state, and description. Disabled rules appear dimmed. The enabled indicator dot and on/off badge provide two visual signals for the toggle state."
        code={codeSnippets.reviewRulesPanel}
        importPath='import { ReviewRulesPanel } from "@/components/code-review-agent/ReviewRulesPanel"'
      >
        <div className="w-full max-w-2xl">
          <ReviewRulesPanel rules={mockRules} />
        </div>
      </ComponentSample>

      {/* Full Review Dashboard Mockup */}
      <section className="space-y-8">
        <h2 className="text-2xl font-bold font-heading">
          Full Review Dashboard Layout
        </h2>
        <p className="text-muted-foreground -mt-4">
          A composite layout combining the summary card, issue list, and rules panel as they would
          appear in a complete code review report.
        </p>
        <div className="p-6 rounded-3xl border border-border/50 bg-background/50 backdrop-blur-sm">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <ReviewSummaryCard
                score={74}
                issuesFound={6}
                errors={2}
                warnings={2}
                suggestions={1}
                filesReviewed={12}
                linesReviewed={1840}
                complexity="medium"
              />
            </div>
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-semibold text-foreground/80">
                Issues ({mockIssues.length})
              </h3>
              <div className="space-y-2">
                {mockIssues.map((issue, i) => (
                  <ReviewIssueRow
                    key={i}
                    severity={issue.severity}
                    filePath={issue.filePath}
                    lineNumber={issue.lineNumber}
                    message={issue.message}
                    ruleId={issue.ruleId}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border/50">
            <h3 className="text-sm font-semibold text-foreground/80 mb-4">
              Active Rules
            </h3>
            <ReviewRulesPanel rules={mockRules} />
          </div>
        </div>
      </section>

      {/* Code Snippets */}
      <CodePreview
        code={codeSnippets.complexityBadge}
        title="Code Review Agent Components"
        tabs={[
          { label: "ComplexityBadge", code: codeSnippets.complexityBadge },
          { label: "ReviewIssueRow", code: codeSnippets.reviewIssueRow },
          { label: "ReviewSummaryCard", code: codeSnippets.reviewSummaryCard },
          { label: "ReviewRulesPanel", code: codeSnippets.reviewRulesPanel },
        ]}
      />

      <AccessibilityPanel
        notes={[
          "ComplexityBadge uses both color and text label — safe for colorblind users.",
          "ReviewIssueRow severity icons (X, AlertTriangle, Info, Lightbulb) supplement color cues.",
          "ReviewIssueRow severity badges include text labels, not color alone.",
          "ReviewRulesPanel uses enabled dot indicator plus on/off badge for dual encoding.",
          "Disabled rules use opacity reduction and text cues, not color alone.",
          "File paths are rendered in monospace code elements for screen reader clarity.",
          "Score ring in ReviewSummaryCard includes a numeric label for non-visual accessibility.",
          "Issue rows use semantic div structure with readable text content.",
          "Rule descriptions provide prose context beyond just the rule name and severity.",
        ]}
      />

      <RelatedComponents currentId="code-review-agent" />
    </div>
  );
}

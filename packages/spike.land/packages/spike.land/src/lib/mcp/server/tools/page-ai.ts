/**
 * Page AI MCP Tools
 *
 * AI-powered page generation and content tools.
 * Simplified/deterministic implementations -- scaffolding for future AI integration.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import type { Prisma } from "@/generated/prisma";

const PAGE_LAYOUTS = [
  "LANDING",
  "FEATURE",
  "STORE",
  "DASHBOARD",
  "ARTICLE",
  "GALLERY",
  "CUSTOM",
] as const;

const THEME_STYLES = ["modern", "minimal", "bold", "playful"] as const;

// ── Schemas ──────────────────────────────────────────────────────────────────

const GeneratePageSchema = z.object({
  prompt: z.string().min(1).describe("Description of the page to generate."),
  slug: z.string().min(1).optional().describe(
    "URL slug for the page (auto-generated from prompt if omitted).",
  ),
  layout: z.enum(PAGE_LAYOUTS).optional().describe(
    "Page layout type. Defaults to LANDING.",
  ),
});

const EnhanceBlockSchema = z.object({
  blockId: z.string().min(1).describe("ID of the PageBlock to enhance."),
  instruction: z.string().min(1).describe("How to improve the block content."),
});

const SuggestLayoutSchema = z.object({
  useCase: z.string().min(1).describe("Description of what the page is for."),
});

const GenerateThemeSchema = z.object({
  brandDescription: z.string().min(1).describe(
    "Description of the brand identity.",
  ),
  primaryColor: z.string().optional().describe(
    "Primary brand color in hex format (e.g. '#3B82F6').",
  ),
  style: z.enum(THEME_STYLES).optional().describe(
    "Visual style preset. Defaults to 'modern'.",
  ),
});

const PopulateStoreSchema = z.object({
  pageSlug: z.string().min(1).describe(
    "Slug of the target page to populate with app entries.",
  ),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSlugFromPrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function extractKeywords(prompt: string): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 3);
  return [...new Set(words)].slice(0, 5);
}

/**
 * Shift a hex color by a given amount (for generating complementary colors).
 */
function shiftHexColor(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ── Registration ─────────────────────────────────────────────────────────────

export function registerPageAiTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // ── Tool 1: page_ai_generate ──────────────────────────────────────────────

  registry.register({
    name: "page_ai_generate",
    description: "Generate a new dynamic page with structured blocks from a text prompt. "
      + "Creates a DRAFT page with HERO, FEATURE_GRID, and CTA blocks.",
    category: "page-ai",
    tier: "workspace",
    inputSchema: GeneratePageSchema.shape,
    handler: async ({
      prompt,
      slug,
      layout,
    }: z.infer<typeof GeneratePageSchema>): Promise<CallToolResult> =>
      safeToolCall("page_ai_generate", async () => {
        const { isReservedSlug } = await import(
          "@/lib/dynamic-pages/block-schemas"
        );

        // Generate or validate slug
        const baseSlug = slug || generateSlugFromPrompt(prompt);
        if (!baseSlug) {
          return textResult(
            "**Error: VALIDATION_ERROR**\nCould not generate a valid slug from the prompt. Please provide a slug explicitly.\n**Retryable:** false",
          );
        }

        if (isReservedSlug(baseSlug)) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nSlug "${baseSlug}" is reserved and cannot be used.\n**Retryable:** false`,
          );
        }

        const prisma = (await import("@/lib/prisma")).default;

        // Check slug uniqueness
        const existing = await prisma.dynamicPage.findUnique({
          where: { slug: baseSlug },
          select: { id: true },
        });

        if (existing) {
          return textResult(
            `**Error: CONFLICT**\nA page with slug "${baseSlug}" already exists.\n**Retryable:** false`,
          );
        }

        // Extract keywords for content generation
        const keywords = extractKeywords(prompt);
        const titleText = prompt.charAt(0).toUpperCase() + prompt.slice(1);

        // Build blocks content
        const heroContent = {
          headline: titleText,
          subheadline: `Discover everything about ${
            keywords.slice(0, 3).join(", ") || "this topic"
          }`,
          ctaText: "Get Started",
          ctaUrl: "#features",
          alignment: "center" as const,
        };

        const featureItems = keywords.slice(0, 3).map((keyword, i) => ({
          title: keyword.charAt(0).toUpperCase() + keyword.slice(1),
          description: `Learn more about ${keyword} and how it can help you.`,
          icon: ["Sparkles", "Zap", "Shield"][i] ?? "Star",
        }));

        // Ensure at least 3 features
        while (featureItems.length < 3) {
          const idx = featureItems.length;
          featureItems.push({
            title: `Feature ${idx + 1}`,
            description: `A key feature of ${titleText.toLowerCase()}.`,
            icon: ["Sparkles", "Zap", "Shield"][idx] ?? "Star",
          });
        }

        const featureGridContent = {
          sectionTitle: "Key Features",
          features: featureItems,
          columns: 3,
        };

        const ctaContent = {
          headline: "Ready to get started?",
          description: `Start building with ${keywords[0] || "this"} today.`,
          buttons: [
            {
              text: "Get Started",
              url: "/signup",
              variant: "primary" as const,
            },
            {
              text: "Learn More",
              url: "#features",
              variant: "outline" as const,
            },
          ],
          variant: "centered" as const,
        };

        // Create the page with blocks in a transaction
        const page = await prisma.dynamicPage.create({
          data: {
            slug: baseSlug,
            title: titleText,
            description: prompt,
            layout: layout ?? "LANDING",
            status: "DRAFT",
            userId,
            blocks: {
              create: [
                {
                  blockType: "HERO",
                  content: heroContent as unknown as Prisma.InputJsonValue,
                  sortOrder: 0,
                  isVisible: true,
                },
                {
                  blockType: "FEATURE_GRID",
                  content: featureGridContent as unknown as Prisma.InputJsonValue,
                  sortOrder: 1,
                  isVisible: true,
                },
                {
                  blockType: "CTA",
                  content: ctaContent as unknown as Prisma.InputJsonValue,
                  sortOrder: 2,
                  isVisible: true,
                },
              ],
            },
          },
          include: {
            blocks: { select: { id: true, blockType: true, sortOrder: true } },
          },
        });

        let text = `**Page Generated**\n\n`
          + `**Title:** ${page.title}\n`
          + `**Slug:** ${page.slug}\n`
          + `**Layout:** ${page.layout}\n`
          + `**Status:** ${page.status}\n`
          + `**Blocks (${page.blocks.length}):**\n`;

        for (const block of page.blocks) {
          text += `  - ${block.blockType} (ID: ${block.id}, order: ${block.sortOrder})\n`;
        }

        text += `\nPage ID: ${page.id}`;

        return textResult(text);
      }),
  });

  // ── Tool 2: page_ai_enhance_block ─────────────────────────────────────────

  registry.register({
    name: "page_ai_enhance_block",
    description: "Review a block and receive enhancement guidance. "
      + "Returns current block content alongside the instruction for manual refinement. "
      + "Placeholder for future AI-powered content enhancement.",
    category: "page-ai",
    tier: "workspace",
    inputSchema: EnhanceBlockSchema.shape,
    handler: async ({
      blockId,
      instruction,
    }: z.infer<typeof EnhanceBlockSchema>): Promise<CallToolResult> =>
      safeToolCall("page_ai_enhance_block", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const block = await prisma.pageBlock.findUnique({
          where: { id: blockId },
        });

        if (!block) {
          return textResult(
            `**Error: NOT_FOUND**\nBlock with ID "${blockId}" not found.\n**Retryable:** false`,
          );
        }

        return textResult(
          `**Block Enhancement Review**\n\n`
            + `**Block ID:** ${block.id}\n`
            + `**Type:** ${block.blockType}\n`
            + `**Instruction:** ${instruction}\n\n`
            + `**Current Content:**\n\`\`\`json\n${
              JSON.stringify(block.content, null, 2)
            }\n\`\`\`\n\n`
            + `**Note:** This is a placeholder for future AI integration. `
            + `To apply the enhancement, use the \`blocks_update\` tool with modified content `
            + `based on the instruction above.`,
        );
      }),
  });

  // ── Tool 3: page_ai_suggest_layout ────────────────────────────────────────

  registry.register({
    name: "page_ai_suggest_layout",
    description:
      "Suggest a page layout and recommended block types based on a use-case description. "
      + "Advisory only -- does not create or modify any data.",
    category: "page-ai",
    tier: "free",
    inputSchema: SuggestLayoutSchema.shape,
    handler: async ({
      useCase,
    }: z.infer<typeof SuggestLayoutSchema>): Promise<CallToolResult> =>
      safeToolCall("page_ai_suggest_layout", async () => {
        const lc = useCase.toLowerCase();

        interface LayoutSuggestion {
          layout: string;
          blocks: string[];
          rationale: string;
        }

        let suggestion: LayoutSuggestion;

        if (lc.includes("landing") || lc.includes("product")) {
          suggestion = {
            layout: "LANDING",
            blocks: [
              "HERO",
              "FEATURE_GRID",
              "TESTIMONIALS",
              "PRICING",
              "CTA",
              "FOOTER",
            ],
            rationale:
              "Landing/product pages benefit from a strong hero, feature showcase, social proof, and clear pricing.",
          };
        } else if (lc.includes("store") || lc.includes("marketplace")) {
          suggestion = {
            layout: "STORE",
            blocks: ["HERO", "APP_GRID", "CTA", "FOOTER"],
            rationale: "Store pages focus on browsable app/product grids with category filtering.",
          };
        } else if (lc.includes("article") || lc.includes("blog")) {
          suggestion = {
            layout: "ARTICLE",
            blocks: ["HERO", "MARKDOWN", "CTA", "FOOTER"],
            rationale:
              "Article pages prioritize readable content with a clear hero and call-to-action.",
          };
        } else if (lc.includes("portfolio") || lc.includes("gallery")) {
          suggestion = {
            layout: "GALLERY",
            blocks: ["HERO", "GALLERY", "TESTIMONIALS", "CTA", "FOOTER"],
            rationale:
              "Portfolio/gallery pages showcase visual work with testimonials for credibility.",
          };
        } else if (lc.includes("comparison") || lc.includes("versus")) {
          suggestion = {
            layout: "FEATURE",
            blocks: [
              "HERO",
              "COMPARISON_TABLE",
              "PRICING",
              "CTA",
              "FOOTER",
            ],
            rationale:
              "Comparison pages need structured tables and pricing to help decision-making.",
          };
        } else {
          suggestion = {
            layout: "LANDING",
            blocks: ["HERO", "FEATURE_GRID", "CTA", "FOOTER"],
            rationale: "A versatile landing layout works well for general-purpose pages.",
          };
        }

        let text = `**Layout Suggestion**\n\n`
          + `**Use Case:** ${useCase}\n`
          + `**Recommended Layout:** ${suggestion.layout}\n`
          + `**Rationale:** ${suggestion.rationale}\n\n`
          + `**Recommended Blocks (${suggestion.blocks.length}):**\n`;

        for (const block of suggestion.blocks) {
          text += `  - ${block}\n`;
        }

        text += `\nTo create a page with this layout, use \`page_ai_generate\` with the `
          + `\`layout\` parameter set to "${suggestion.layout}".`;

        return textResult(text);
      }),
  });

  // ── Tool 4: page_ai_generate_theme ────────────────────────────────────────

  registry.register({
    name: "page_ai_generate_theme",
    description: "Generate a LandingTheme-compatible JSON theme from a brand description. "
      + "Deterministic color and style generation based on inputs.",
    category: "page-ai",
    tier: "workspace",
    inputSchema: GenerateThemeSchema.shape,
    handler: async ({
      brandDescription,
      primaryColor,
      style,
    }: z.infer<typeof GenerateThemeSchema>): Promise<CallToolResult> =>
      safeToolCall("page_ai_generate_theme", async () => {
        const resolvedStyle = style ?? "modern";
        const primary = primaryColor ?? "#3B82F6";

        // Generate complementary colors from primary
        const secondary = shiftHexColor(primary, -40);
        const accent = shiftHexColor(primary, 60);
        const background = shiftHexColor(primary, 200);
        const foreground = shiftHexColor(primary, -180);

        // Style-specific settings
        interface StyleSettings {
          fontWeight: string;
          borderRadius: string;
          spacing: string;
          headingStyle: string;
        }

        const styleSettings: Record<string, StyleSettings> = {
          modern: {
            fontWeight: "500",
            borderRadius: "0.5rem",
            spacing: "1.5rem",
            headingStyle: "clean",
          },
          minimal: {
            fontWeight: "400",
            borderRadius: "0.25rem",
            spacing: "2rem",
            headingStyle: "light",
          },
          bold: {
            fontWeight: "700",
            borderRadius: "0.75rem",
            spacing: "1.25rem",
            headingStyle: "heavy",
          },
          playful: {
            fontWeight: "500",
            borderRadius: "1rem",
            spacing: "1.75rem",
            headingStyle: "rounded",
          },
        };

        const settings = styleSettings[resolvedStyle]
          ?? styleSettings.modern;

        // Derive a theme name from brand description
        const nameWords = brandDescription
          .split(/\s+/)
          .slice(0, 3)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        const themeName = `${nameWords.join(" ")} Theme`;

        const theme = {
          name: themeName,
          style: resolvedStyle,
          colors: {
            primary,
            secondary,
            accent,
            background,
            foreground,
            muted: shiftHexColor(primary, 150),
            border: shiftHexColor(primary, 120),
          },
          typography: {
            fontWeight: settings?.fontWeight ?? "500",
            headingStyle: settings?.headingStyle ?? "clean",
          },
          layout: {
            borderRadius: settings?.borderRadius ?? "0.5rem",
            spacing: settings?.spacing ?? "1.5rem",
          },
        };

        return textResult(
          `**Generated Theme**\n\n`
            + `**Name:** ${theme.name}\n`
            + `**Style:** ${theme.style}\n`
            + `**Brand:** ${brandDescription}\n\n`
            + `**Theme JSON:**\n\`\`\`json\n${JSON.stringify(theme, null, 2)}\n\`\`\`\n\n`
            + `To apply this theme, update the page's \`themeData\` field with the JSON above.`,
        );
      }),
  });

  // ── Tool 5: page_ai_populate_store ────────────────────────────────────────

  registry.register({
    name: "page_ai_populate_store",
    description: "Populate a page with a sample APP_GRID block containing categorized app entries. "
      + "Creates demo apps organized by common MCP tool categories.",
    category: "page-ai",
    tier: "workspace",
    inputSchema: PopulateStoreSchema.shape,
    handler: async ({
      pageSlug,
    }: z.infer<typeof PopulateStoreSchema>): Promise<CallToolResult> =>
      safeToolCall("page_ai_populate_store", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const page = await prisma.dynamicPage.findUnique({
          where: { slug: pageSlug },
          select: { id: true, title: true },
        });

        if (!page) {
          return textResult(
            `**Error: NOT_FOUND**\nPage with slug "${pageSlug}" not found.\n**Retryable:** false`,
          );
        }

        const categories = [
          "Image & Creative",
          "Development",
          "Communication",
          "Analytics",
          "AI & Automation",
        ];

        interface SampleApp {
          name: string;
          tagline: string;
          icon: string;
          category: string;
          mcpTools: string[];
          features: string[];
        }

        const sampleApps: SampleApp[] = [
          // Image & Creative
          {
            name: "PixelForge",
            tagline: "AI-powered image generation and editing",
            icon: "Image",
            category: "Image & Creative",
            mcpTools: ["image_generate", "image_enhance"],
            features: ["Text-to-image", "Style transfer", "Batch processing"],
          },
          {
            name: "BrandKit",
            tagline: "Create consistent brand assets",
            icon: "Palette",
            category: "Image & Creative",
            mcpTools: ["image_generate"],
            features: ["Logo generator", "Color palettes", "Typography"],
          },
          // Development
          {
            name: "CodePilot",
            tagline: "AI code review and suggestions",
            icon: "Code",
            category: "Development",
            mcpTools: ["codespace_create", "codespace_deploy"],
            features: ["Code review", "Auto-fix", "Performance hints"],
          },
          {
            name: "DeployBot",
            tagline: "One-click deployment automation",
            icon: "Rocket",
            category: "Development",
            mcpTools: ["codespace_deploy"],
            features: ["CI/CD pipelines", "Rollback", "Monitoring"],
          },
          {
            name: "TestRunner",
            tagline: "Automated testing suite",
            icon: "FlaskConical",
            category: "Development",
            mcpTools: ["codespace_create"],
            features: ["Unit tests", "Integration tests", "Coverage reports"],
          },
          // Communication
          {
            name: "TeamSync",
            tagline: "Real-time team collaboration",
            icon: "MessageSquare",
            category: "Communication",
            mcpTools: ["chat_send"],
            features: ["Group chat", "File sharing", "Video calls"],
          },
          {
            name: "NotifyHub",
            tagline: "Multi-channel notification center",
            icon: "Bell",
            category: "Communication",
            mcpTools: ["chat_send"],
            features: ["Email", "SMS", "Push notifications"],
          },
          // Analytics
          {
            name: "InsightDash",
            tagline: "Real-time analytics dashboard",
            icon: "BarChart3",
            category: "Analytics",
            mcpTools: ["reports_generate"],
            features: ["Custom dashboards", "Data export", "Alerts"],
          },
          {
            name: "TrendWatch",
            tagline: "Market trend analysis",
            icon: "TrendingUp",
            category: "Analytics",
            mcpTools: ["reports_generate"],
            features: ["Trend detection", "Forecasting", "Competitor analysis"],
          },
          // AI & Automation
          {
            name: "AutoFlow",
            tagline: "Visual workflow automation",
            icon: "Workflow",
            category: "AI & Automation",
            mcpTools: ["jules_queue_task"],
            features: ["Drag-and-drop builder", "Triggers", "Integrations"],
          },
          {
            name: "SmartAgent",
            tagline: "Autonomous AI task execution",
            icon: "Bot",
            category: "AI & Automation",
            mcpTools: ["jules_queue_task", "chat_send"],
            features: [
              "Task queue",
              "Background processing",
              "Status tracking",
            ],
          },
          {
            name: "DataPipe",
            tagline: "Automated data transformation",
            icon: "ArrowRightLeft",
            category: "AI & Automation",
            mcpTools: ["jules_queue_task"],
            features: ["ETL pipelines", "Data cleaning", "Scheduling"],
          },
        ];

        const appGridContent = {
          sectionTitle: "App Store",
          apps: sampleApps,
          categories,
        };

        // Determine next sort order
        const maxBlock = await prisma.pageBlock.findFirst({
          where: { pageId: page.id },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        const nextSortOrder = maxBlock ? maxBlock.sortOrder + 1 : 0;

        const block = await prisma.pageBlock.create({
          data: {
            pageId: page.id,
            blockType: "APP_GRID",
            content: appGridContent as unknown as Prisma.InputJsonValue,
            sortOrder: nextSortOrder,
            isVisible: true,
          },
        });

        return textResult(
          `**Store Populated**\n\n`
            + `**Page:** ${page.title} (${pageSlug})\n`
            + `**Block ID:** ${block.id}\n`
            + `**Block Type:** APP_GRID\n`
            + `**Sort Order:** ${block.sortOrder}\n`
            + `**Categories (${categories.length}):** ${categories.join(", ")}\n`
            + `**Apps Added:** ${sampleApps.length}\n\n`
            + `Apps per category:\n`
            + categories
              .map(cat => {
                const count = sampleApps.filter(a => a.category === cat).length;
                return `  - ${cat}: ${count} apps`;
              })
              .join("\n"),
        );
      }),
  });
}

/**
 * Block Content Schemas
 *
 * Zod schemas for validating JSON content of each PageBlock type.
 * Used by MCP tools and the DynamicPageRenderer.
 */

import { z } from "zod";
import type { BlockType } from "@/generated/prisma";

// ─── Individual Block Content Schemas ─────────────────────────────────────────

export const HeroContentSchema = z.object({
  headline: z.string().min(1).describe("Main headline text."),
  subheadline: z.string().optional().describe("Supporting subheadline text."),
  ctaText: z.string().optional().describe("Call-to-action button text."),
  ctaUrl: z.string().optional().describe("Call-to-action button URL."),
  backgroundImage: z.string().optional().describe("Background image URL."),
  alignment: z
    .enum(["left", "center", "right"])
    .optional()
    .default("center")
    .describe("Text alignment."),
});

export const FeatureGridContentSchema = z.object({
  sectionTitle: z.string().optional().describe("Section heading."),
  features: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string(),
        icon: z.string().optional().describe("Lucide icon name."),
      }),
    )
    .min(1)
    .describe("List of features to display."),
  columns: z
    .number()
    .int()
    .min(1)
    .max(6)
    .optional()
    .default(3)
    .describe("Number of grid columns."),
});

export const FeatureListContentSchema = z.object({
  sectionTitle: z.string().optional().describe("Section heading."),
  features: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string(),
        icon: z.string().optional().describe("Lucide icon name."),
      }),
    )
    .min(1)
    .describe("List of features."),
});

export const CtaContentSchema = z.object({
  headline: z.string().min(1).describe("CTA headline."),
  description: z.string().optional().describe("Supporting description."),
  buttons: z
    .array(
      z.object({
        text: z.string().min(1),
        url: z.string(),
        variant: z
          .enum(["primary", "secondary", "outline", "ghost"])
          .optional()
          .default("primary"),
      }),
    )
    .min(1)
    .describe("CTA buttons."),
  variant: z
    .enum(["default", "centered", "split"])
    .optional()
    .default("default")
    .describe("CTA layout variant."),
});

export const PricingContentSchema = z.object({
  sectionTitle: z.string().optional().describe("Section heading."),
  tiers: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.string().describe("Price display string (e.g. '$9/mo')."),
        features: z.array(z.string()),
        highlighted: z.boolean().optional().default(false),
        ctaText: z.string().optional().default("Get Started"),
        ctaUrl: z.string().optional(),
      }),
    )
    .min(1)
    .describe("Pricing tiers."),
});

export const TestimonialsContentSchema = z.object({
  sectionTitle: z.string().optional().describe("Section heading."),
  testimonials: z
    .array(
      z.object({
        quote: z.string().min(1),
        author: z.string().min(1),
        role: z.string().optional(),
        avatarUrl: z.string().optional(),
      }),
    )
    .min(1)
    .describe("Testimonials."),
});

export const StatsContentSchema = z.object({
  sectionTitle: z.string().optional().describe("Section heading."),
  stats: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        suffix: z.string().optional(),
      }),
    )
    .min(1)
    .describe("Statistics to display."),
});

export const GalleryContentSchema = z.object({
  sectionTitle: z.string().optional().describe("Section heading."),
  images: z
    .array(
      z.object({
        src: z.string().min(1),
        alt: z.string().optional().default(""),
        caption: z.string().optional(),
      }),
    )
    .min(1)
    .describe("Gallery images."),
  columns: z
    .number()
    .int()
    .min(1)
    .max(6)
    .optional()
    .default(3)
    .describe("Number of grid columns."),
});

export const FaqContentSchema = z.object({
  sectionTitle: z.string().optional().describe("Section heading."),
  items: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .min(1)
    .describe("FAQ items."),
});

export const FooterContentSchema = z.object({
  links: z
    .array(
      z.object({
        label: z.string().min(1),
        url: z.string(),
      }),
    )
    .optional()
    .default([])
    .describe("Footer links."),
  copyright: z.string().optional().describe("Copyright text."),
});

export const ComparisonTableContentSchema = z.object({
  sectionTitle: z.string().optional().describe("Section heading."),
  headers: z.array(z.string()).min(2).describe("Table column headers."),
  rows: z
    .array(
      z.object({
        feature: z.string().min(1),
        values: z.array(z.string()),
      }),
    )
    .min(1)
    .describe("Table rows."),
});

export const AppGridContentSchema = z.object({
  sectionTitle: z.string().optional().describe("Section heading."),
  apps: z
    .array(
      z.object({
        name: z.string().min(1),
        tagline: z.string().optional(),
        icon: z.string().optional().describe("Lucide icon name."),
        category: z.string().optional(),
        mcpTools: z.array(z.string()).optional().default([]),
        features: z.array(z.string()).optional().default([]),
      }),
    )
    .min(1)
    .describe("Apps to display."),
  categories: z.array(z.string()).optional().default([]).describe(
    "Category filter tabs.",
  ),
});

export const MarkdownContentSchema = z.object({
  content: z.string().min(1).describe("Markdown content to render."),
});

export const CustomReactContentSchema = z.object({
  componentName: z.string().min(1).describe("Registered component name."),
  props: z.record(z.string(), z.unknown()).optional().default({}).describe(
    "Component props.",
  ),
});

// ─── Schema Map ───────────────────────────────────────────────────────────────

export const BLOCK_CONTENT_SCHEMAS: Record<BlockType, z.ZodTypeAny> = {
  HERO: HeroContentSchema,
  FEATURE_GRID: FeatureGridContentSchema,
  FEATURE_LIST: FeatureListContentSchema,
  CTA: CtaContentSchema,
  TESTIMONIALS: TestimonialsContentSchema,
  PRICING: PricingContentSchema,
  STATS: StatsContentSchema,
  GALLERY: GalleryContentSchema,
  FAQ: FaqContentSchema,
  FOOTER: FooterContentSchema,
  COMPARISON_TABLE: ComparisonTableContentSchema,
  APP_GRID: AppGridContentSchema,
  MARKDOWN: MarkdownContentSchema,
  CUSTOM_REACT: CustomReactContentSchema,
};

/**
 * Validate block content against its type-specific schema.
 * Returns `{ success: true, data }` or `{ success: false, error }`.
 */
export function validateBlockContent(
  blockType: BlockType,
  content: unknown,
): { success: true; data: unknown; } | { success: false; error: string; } {
  const schema = BLOCK_CONTENT_SCHEMAS[blockType];
  if (!schema) {
    return { success: false, error: `Unknown block type: ${blockType}` };
  }

  const result = schema.safeParse(content);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const issues = result.error.issues
    .map(i => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { success: false, error: issues };
}

// ─── Reserved Slugs ───────────────────────────────────────────────────────────

export const RESERVED_SLUGS = [
  "connect",
  "learnit",
  "create",
  "mcp",
  "blog",
  "docs",
  "admin",
  "orbit",
  "career",
  "store",
  "landing",
  "features",
  "personas",
  "bazdmeg",
  "login",
  "signup",
  "api",
  "auth",
  "p",
  "preview",
  "settings",
  "profile",
  "dashboard",
  "arena",
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

/**
 * Check if a slug is reserved (used by existing routes).
 */
export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(
    slug.split("/")[0] ?? slug,
  );
}

/**
 * Get human-readable descriptions for each block type.
 */
export function getBlockTypeDescriptions(): Record<BlockType, string> {
  return {
    HERO: "Hero banner with headline, subheadline, CTA button, and optional background image",
    FEATURE_GRID: "Grid layout of feature cards with title, description, and icon",
    FEATURE_LIST: "Vertical list of features with title, description, and icon",
    CTA: "Call-to-action section with headline, description, and action buttons",
    TESTIMONIALS: "Customer testimonial cards with quote, author, and avatar",
    PRICING: "Pricing tier comparison cards with features and CTA",
    STATS: "Statistics display with label, value, and optional suffix",
    GALLERY: "Image gallery grid with captions",
    FAQ: "Frequently asked questions accordion",
    FOOTER: "Footer section with links and copyright",
    COMPARISON_TABLE: "Feature comparison table with headers and rows",
    APP_GRID: "App store-style grid with filterable categories",
    MARKDOWN: "Rich text content rendered from Markdown",
    CUSTOM_REACT: "Custom React component with dynamic props",
  };
}

import { describe, expect, it } from "vitest";
import type { BlockType } from "@/generated/prisma";
import {
  AppGridContentSchema,
  BLOCK_CONTENT_SCHEMAS,
  ComparisonTableContentSchema,
  CtaContentSchema,
  CustomReactContentSchema,
  FaqContentSchema,
  FeatureGridContentSchema,
  FeatureListContentSchema,
  FooterContentSchema,
  GalleryContentSchema,
  getBlockTypeDescriptions,
  HeroContentSchema,
  isReservedSlug,
  MarkdownContentSchema,
  PricingContentSchema,
  RESERVED_SLUGS,
  StatsContentSchema,
  TestimonialsContentSchema,
  validateBlockContent,
} from "./block-schemas";

// ─── Individual Block Content Schemas ─────────────────────────────────────────

describe("HeroContentSchema", () => {
  it("accepts valid data with headline and alignment", () => {
    const result = HeroContentSchema.safeParse({
      headline: "Welcome to Spike Land",
      alignment: "left",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headline).toBe("Welcome to Spike Land");
      expect(result.data.alignment).toBe("left");
    }
  });

  it("defaults alignment to center", () => {
    const result = HeroContentSchema.safeParse({ headline: "Hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alignment).toBe("center");
    }
  });

  it("accepts all optional fields", () => {
    const result = HeroContentSchema.safeParse({
      headline: "Main Title",
      subheadline: "Subtitle here",
      ctaText: "Get Started",
      ctaUrl: "/signup",
      backgroundImage: "https://example.com/bg.jpg",
      alignment: "right",
    });
    expect(result.success).toBe(true);
  });

  it("rejects data without headline", () => {
    const result = HeroContentSchema.safeParse({ alignment: "center" });
    expect(result.success).toBe(false);
  });

  it("rejects empty headline", () => {
    const result = HeroContentSchema.safeParse({ headline: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid alignment", () => {
    const result = HeroContentSchema.safeParse({
      headline: "Title",
      alignment: "top",
    });
    expect(result.success).toBe(false);
  });
});

describe("FeatureGridContentSchema", () => {
  const validFeature = {
    title: "Fast",
    description: "Lightning fast performance",
  };

  it("accepts valid data with features array", () => {
    const result = FeatureGridContentSchema.safeParse({
      features: [validFeature],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.columns).toBe(3); // default
    }
  });

  it("accepts optional sectionTitle, columns, and icon", () => {
    const result = FeatureGridContentSchema.safeParse({
      sectionTitle: "Our Features",
      features: [{ ...validFeature, icon: "Zap" }],
      columns: 4,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty features array", () => {
    const result = FeatureGridContentSchema.safeParse({ features: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing features", () => {
    const result = FeatureGridContentSchema.safeParse({
      sectionTitle: "Title",
    });
    expect(result.success).toBe(false);
  });

  it("rejects columns outside range", () => {
    const result = FeatureGridContentSchema.safeParse({
      features: [validFeature],
      columns: 7,
    });
    expect(result.success).toBe(false);
  });
});

describe("FeatureListContentSchema", () => {
  const validFeature = {
    title: "Secure",
    description: "End-to-end encryption",
  };

  it("accepts valid data with features array", () => {
    const result = FeatureListContentSchema.safeParse({
      features: [validFeature],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty features array", () => {
    const result = FeatureListContentSchema.safeParse({ features: [] });
    expect(result.success).toBe(false);
  });

  it("rejects feature with empty title", () => {
    const result = FeatureListContentSchema.safeParse({
      features: [{ title: "", description: "desc" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("CtaContentSchema", () => {
  const validButton = { text: "Sign Up", url: "/signup" };

  it("accepts valid data with headline and buttons", () => {
    const result = CtaContentSchema.safeParse({
      headline: "Ready to start?",
      buttons: [validButton],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variant).toBe("default");
      expect(result.data.buttons[0]!.variant).toBe("primary");
    }
  });

  it("rejects missing headline", () => {
    const result = CtaContentSchema.safeParse({ buttons: [validButton] });
    expect(result.success).toBe(false);
  });

  it("rejects empty buttons array", () => {
    const result = CtaContentSchema.safeParse({
      headline: "CTA",
      buttons: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts all variant types", () => {
    for (const variant of ["default", "centered", "split"] as const) {
      const result = CtaContentSchema.safeParse({
        headline: "Test",
        buttons: [validButton],
        variant,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("PricingContentSchema", () => {
  const validTier = { name: "Pro", price: "$9/mo", features: ["Feature A"] };

  it("accepts valid data with tiers", () => {
    const result = PricingContentSchema.safeParse({ tiers: [validTier] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tiers[0]!.highlighted).toBe(false);
      expect(result.data.tiers[0]!.ctaText).toBe("Get Started");
    }
  });

  it("rejects empty tiers array", () => {
    const result = PricingContentSchema.safeParse({ tiers: [] });
    expect(result.success).toBe(false);
  });

  it("rejects tier without name", () => {
    const result = PricingContentSchema.safeParse({
      tiers: [{ price: "$5", features: [] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("TestimonialsContentSchema", () => {
  const validTestimonial = { quote: "Amazing!", author: "Jane Doe" };

  it("accepts valid data with testimonials", () => {
    const result = TestimonialsContentSchema.safeParse({
      testimonials: [validTestimonial],
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional role and avatarUrl", () => {
    const result = TestimonialsContentSchema.safeParse({
      testimonials: [{
        ...validTestimonial,
        role: "CTO",
        avatarUrl: "/avatar.jpg",
      }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty testimonials array", () => {
    const result = TestimonialsContentSchema.safeParse({ testimonials: [] });
    expect(result.success).toBe(false);
  });

  it("rejects testimonial without author", () => {
    const result = TestimonialsContentSchema.safeParse({
      testimonials: [{ quote: "Great!" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("StatsContentSchema", () => {
  const validStat = { label: "Users", value: "10K" };

  it("accepts valid data with stats", () => {
    const result = StatsContentSchema.safeParse({ stats: [validStat] });
    expect(result.success).toBe(true);
  });

  it("accepts optional suffix", () => {
    const result = StatsContentSchema.safeParse({
      stats: [{ ...validStat, suffix: "+" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty stats array", () => {
    const result = StatsContentSchema.safeParse({ stats: [] });
    expect(result.success).toBe(false);
  });

  it("rejects stat with empty label", () => {
    const result = StatsContentSchema.safeParse({
      stats: [{ label: "", value: "100" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("GalleryContentSchema", () => {
  const validImage = { src: "https://example.com/img.jpg" };

  it("accepts valid data with images", () => {
    const result = GalleryContentSchema.safeParse({ images: [validImage] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.columns).toBe(3);
      expect(result.data.images[0]!.alt).toBe("");
    }
  });

  it("accepts optional caption and alt", () => {
    const result = GalleryContentSchema.safeParse({
      images: [{ ...validImage, alt: "A photo", caption: "Beautiful sunset" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty images array", () => {
    const result = GalleryContentSchema.safeParse({ images: [] });
    expect(result.success).toBe(false);
  });

  it("rejects image with empty src", () => {
    const result = GalleryContentSchema.safeParse({
      images: [{ src: "" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("FaqContentSchema", () => {
  const validItem = { question: "What is this?", answer: "A platform." };

  it("accepts valid data with items", () => {
    const result = FaqContentSchema.safeParse({ items: [validItem] });
    expect(result.success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = FaqContentSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects item with empty question", () => {
    const result = FaqContentSchema.safeParse({
      items: [{ question: "", answer: "Answer" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects item with empty answer", () => {
    const result = FaqContentSchema.safeParse({
      items: [{ question: "Q?", answer: "" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("FooterContentSchema", () => {
  it("accepts valid data with links and copyright", () => {
    const result = FooterContentSchema.safeParse({
      links: [{ label: "Privacy", url: "/privacy" }],
      copyright: "2026 Spike Land",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    const result = FooterContentSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.links).toEqual([]);
    }
  });

  it("rejects link with empty label", () => {
    const result = FooterContentSchema.safeParse({
      links: [{ label: "", url: "/about" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("ComparisonTableContentSchema", () => {
  const validData = {
    headers: ["Feature", "Free", "Pro"],
    rows: [{ feature: "Storage", values: ["1GB", "100GB"] }],
  };

  it("accepts valid data with headers and rows", () => {
    const result = ComparisonTableContentSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects headers with fewer than 2 items", () => {
    const result = ComparisonTableContentSchema.safeParse({
      headers: ["Only One"],
      rows: [{ feature: "X", values: ["Y"] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty rows array", () => {
    const result = ComparisonTableContentSchema.safeParse({
      headers: ["A", "B"],
      rows: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects row with empty feature", () => {
    const result = ComparisonTableContentSchema.safeParse({
      headers: ["A", "B"],
      rows: [{ feature: "", values: ["x"] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("AppGridContentSchema", () => {
  const validApp = { name: "My App" };

  it("accepts valid data with apps", () => {
    const result = AppGridContentSchema.safeParse({ apps: [validApp] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categories).toEqual([]);
      expect(result.data.apps[0]!.mcpTools).toEqual([]);
      expect(result.data.apps[0]!.features).toEqual([]);
    }
  });

  it("accepts all optional fields", () => {
    const result = AppGridContentSchema.safeParse({
      sectionTitle: "Apps",
      apps: [{
        name: "Toolbox",
        tagline: "All-in-one",
        icon: "Wrench",
        category: "Utilities",
        mcpTools: ["tool1"],
        features: ["feat1"],
      }],
      categories: ["Utilities", "Productivity"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty apps array", () => {
    const result = AppGridContentSchema.safeParse({ apps: [] });
    expect(result.success).toBe(false);
  });

  it("rejects app with empty name", () => {
    const result = AppGridContentSchema.safeParse({
      apps: [{ name: "" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("MarkdownContentSchema", () => {
  it("accepts valid markdown content", () => {
    const result = MarkdownContentSchema.safeParse({
      content: "# Hello World",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = MarkdownContentSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing content", () => {
    const result = MarkdownContentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("CustomReactContentSchema", () => {
  it("accepts valid component name", () => {
    const result = CustomReactContentSchema.safeParse({
      componentName: "MyWidget",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.props).toEqual({});
    }
  });

  it("accepts component with props", () => {
    const result = CustomReactContentSchema.safeParse({
      componentName: "Chart",
      props: { data: [1, 2, 3], color: "blue" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty componentName", () => {
    const result = CustomReactContentSchema.safeParse({ componentName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing componentName", () => {
    const result = CustomReactContentSchema.safeParse({ props: {} });
    expect(result.success).toBe(false);
  });
});

// ─── BLOCK_CONTENT_SCHEMAS Map ────────────────────────────────────────────────

describe("BLOCK_CONTENT_SCHEMAS", () => {
  const expectedTypes: BlockType[] = [
    "HERO",
    "FEATURE_GRID",
    "FEATURE_LIST",
    "CTA",
    "TESTIMONIALS",
    "PRICING",
    "STATS",
    "GALLERY",
    "FAQ",
    "FOOTER",
    "COMPARISON_TABLE",
    "APP_GRID",
    "MARKDOWN",
    "CUSTOM_REACT",
  ];

  it("has all 14 block types", () => {
    expect(Object.keys(BLOCK_CONTENT_SCHEMAS)).toHaveLength(14);
  });

  it("contains every expected block type", () => {
    for (const type of expectedTypes) {
      expect(BLOCK_CONTENT_SCHEMAS).toHaveProperty(type);
    }
  });

  it("maps each type to a Zod schema with safeParse", () => {
    for (const type of expectedTypes) {
      const schema = BLOCK_CONTENT_SCHEMAS[type];
      expect(typeof schema.safeParse).toBe("function");
    }
  });
});

// ─── validateBlockContent ─────────────────────────────────────────────────────

describe("validateBlockContent", () => {
  it("returns success with valid HERO data", () => {
    const result = validateBlockContent("HERO", { headline: "Hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveProperty("headline", "Hello");
    }
  });

  it("returns success with valid FEATURE_GRID data", () => {
    const result = validateBlockContent("FEATURE_GRID", {
      features: [{ title: "Fast", description: "Very fast" }],
    });
    expect(result.success).toBe(true);
  });

  it("returns success with valid MARKDOWN data", () => {
    const result = validateBlockContent("MARKDOWN", { content: "# Title" });
    expect(result.success).toBe(true);
  });

  it("returns success with valid FOOTER data", () => {
    const result = validateBlockContent("FOOTER", {
      copyright: "2026 Spike Land",
    });
    expect(result.success).toBe(true);
  });

  it("returns error with invalid HERO data (missing headline)", () => {
    const result = validateBlockContent("HERO", {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("headline");
    }
  });

  it("returns error with invalid FEATURE_GRID data (empty features)", () => {
    const result = validateBlockContent("FEATURE_GRID", { features: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("features");
    }
  });

  it("returns error with invalid PRICING data (missing tiers)", () => {
    const result = validateBlockContent("PRICING", {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("tiers");
    }
  });

  it("returns error for unknown block type", () => {
    const result = validateBlockContent("UNKNOWN" as BlockType, {
      data: "test",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Unknown block type: UNKNOWN");
    }
  });

  it("returns error with detailed issue paths for nested validation errors", () => {
    const result = validateBlockContent("FEATURE_GRID", {
      features: [{ title: "", description: "desc" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("features.0.title");
    }
  });
});

// ─── RESERVED_SLUGS ──────────────────────────────────────────────────────────

describe("RESERVED_SLUGS", () => {
  it("contains expected reserved slugs", () => {
    const expected = [
      "connect",
      "store",
      "api",
      "admin",
      "auth",
      "login",
      "signup",
      "dashboard",
    ];
    for (const slug of expected) {
      expect(RESERVED_SLUGS).toContain(slug);
    }
  });

  it("has a reasonable number of entries", () => {
    expect(RESERVED_SLUGS.length).toBeGreaterThanOrEqual(10);
    expect(RESERVED_SLUGS.length).toBeLessThan(100);
  });

  it("contains only non-empty strings", () => {
    for (const slug of RESERVED_SLUGS) {
      expect(slug.length).toBeGreaterThan(0);
    }
  });
});

// ─── isReservedSlug ──────────────────────────────────────────────────────────

describe("isReservedSlug", () => {
  it("returns true for reserved slugs", () => {
    expect(isReservedSlug("store")).toBe(true);
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("login")).toBe(true);
    expect(isReservedSlug("connect")).toBe(true);
  });

  it("returns false for non-reserved slugs", () => {
    expect(isReservedSlug("my-page")).toBe(false);
    expect(isReservedSlug("hello-world")).toBe(false);
    expect(isReservedSlug("custom-landing")).toBe(false);
  });

  it("handles nested slugs by checking the first segment", () => {
    expect(isReservedSlug("store/my-app")).toBe(true);
    expect(isReservedSlug("admin/settings")).toBe(true);
    expect(isReservedSlug("api/v1/users")).toBe(true);
  });

  it("returns false for nested slugs with non-reserved first segment", () => {
    expect(isReservedSlug("my-site/store")).toBe(false);
    expect(isReservedSlug("custom/admin")).toBe(false);
  });
});

// ─── getBlockTypeDescriptions ────────────────────────────────────────────────

describe("getBlockTypeDescriptions", () => {
  it("returns descriptions for all 14 block types", () => {
    const descriptions = getBlockTypeDescriptions();
    expect(Object.keys(descriptions)).toHaveLength(14);
  });

  it("has all expected block type keys", () => {
    const descriptions = getBlockTypeDescriptions();
    const expectedKeys: BlockType[] = [
      "HERO",
      "FEATURE_GRID",
      "FEATURE_LIST",
      "CTA",
      "TESTIMONIALS",
      "PRICING",
      "STATS",
      "GALLERY",
      "FAQ",
      "FOOTER",
      "COMPARISON_TABLE",
      "APP_GRID",
      "MARKDOWN",
      "CUSTOM_REACT",
    ];
    for (const key of expectedKeys) {
      expect(descriptions).toHaveProperty(key);
    }
  });

  it("has non-empty string descriptions for all types", () => {
    const descriptions = getBlockTypeDescriptions();
    for (const [key, value] of Object.entries(descriptions)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      // Verify it's a meaningful description, not just whitespace
      expect(value.trim().length).toBeGreaterThan(0);
      // Sanity check: the key should be a known block type
      expect(key).toMatch(
        /^(HERO|FEATURE_GRID|FEATURE_LIST|CTA|TESTIMONIALS|PRICING|STATS|GALLERY|FAQ|FOOTER|COMPARISON_TABLE|APP_GRID|MARKDOWN|CUSTOM_REACT)$/,
      );
    }
  });
});

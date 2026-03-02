"use client";

import type { BlockType, PageLayout, PageStatus } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";
import { LandingThemeProvider } from "@/components/landing-sections/context/LandingThemeContext";
import type { LandingTheme } from "@/components/landing-sections/themes/types";
import { BlockRenderer } from "./BlockRenderer";

interface PageBlock {
  id: string;
  blockType: BlockType;
  variant: string | null;
  content: Prisma.JsonValue;
  sortOrder: number;
  isVisible: boolean;
}

interface DynamicPageData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  layout: PageLayout;
  status: PageStatus;
  themeData: Prisma.JsonValue | null;
  customCss: string | null;
  blocks: PageBlock[];
}

interface DynamicPageRendererProps {
  page: DynamicPageData;
}

/**
 * Top-level renderer for dynamic pages built from PageBlock data.
 * Filters visible blocks, sorts by sortOrder, and optionally
 * wraps in a LandingThemeProvider when themeData is present.
 *
 * Note: customCss is authored by authenticated page creators via
 * MCP tools (not arbitrary user input), so inline style injection
 * is acceptable here.
 */
export function DynamicPageRenderer({ page }: DynamicPageRendererProps) {
  const visibleBlocks = page.blocks
    .filter((block) => block.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const content = (
    <main className="min-h-screen">
      {visibleBlocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
      {page.customCss ? (
        // customCss is set by authenticated page creators via MCP tools,
        // not by untrusted user input. Sanitization happens at the MCP layer.
        <style dangerouslySetInnerHTML={{ __html: page.customCss }} />
      ) : null}
    </main>
  );

  if (page.themeData && typeof page.themeData === "object") {
    const theme = page.themeData as unknown as LandingTheme;
    return <LandingThemeProvider theme={theme}>{content}</LandingThemeProvider>;
  }

  return content;
}

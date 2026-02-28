"use client";

import {
  AccessibilityPanel,
  Breadcrumbs,
  ComponentSample,
  PageHeader,
  RelatedComponents,
  UsageGuide,
} from "@/components/storybook";
import { PageBlockPalette } from "@/components/page-builder/PageBlockPalette";
import { PageCanvasPreview } from "@/components/page-builder/PageCanvasPreview";
import { PagePublishToolbar } from "@/components/page-builder/PagePublishToolbar";
import { PageProjectCard } from "@/components/page-builder/PageProjectCard";
import {
  AlignLeft,
  Columns2,
  Image,
  LayoutTemplate,
  MessageSquare,
  Minus,
  MousePointer2,
  Star,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockBlocks = [
  {
    id: "hero",
    label: "Hero",
    icon: LayoutTemplate,
    description: "Full-width banner with headline and CTA",
  },
  {
    id: "text",
    label: "Text",
    icon: AlignLeft,
    description: "Rich text paragraph block",
  },
  {
    id: "image",
    label: "Image",
    icon: Image,
    description: "Single image with optional caption",
  },
  {
    id: "cta",
    label: "Call to Action",
    icon: MousePointer2,
    description: "Highlighted section with action button",
  },
  {
    id: "divider",
    label: "Divider",
    icon: Minus,
    description: "Horizontal rule to separate sections",
  },
  {
    id: "columns",
    label: "Columns",
    icon: Columns2,
    description: "Two or three column layout",
  },
  {
    id: "testimonial",
    label: "Testimonial",
    icon: MessageSquare,
    description: "Quote with attribution and avatar",
  },
  {
    id: "featured",
    label: "Featured",
    icon: Star,
    description: "Highlighted feature or product spotlight",
  },
];

const mockCanvasBlocks = [
  {
    id: "b1",
    type: "hero" as const,
    content: "Hero banner",
  },
  {
    id: "b2",
    type: "text" as const,
    content: "Body text paragraph",
  },
  {
    id: "b3",
    type: "image" as const,
    content: "Drop image here",
  },
  {
    id: "b4",
    type: "divider" as const,
    content: "",
  },
  {
    id: "b5",
    type: "cta" as const,
    content: "Call to action",
  },
];

const mockProjects = [
  {
    projectName: "Marketing Landing",
    pageCount: 5,
    publishStatus: "published" as const,
    lastModified: "2 hours ago",
    thumbnailUrl: undefined,
  },
  {
    projectName: "Product Launch",
    pageCount: 3,
    publishStatus: "draft" as const,
    lastModified: "yesterday",
    thumbnailUrl: undefined,
  },
  {
    projectName: "Q1 Campaign",
    pageCount: 8,
    publishStatus: "scheduled" as const,
    lastModified: "3 days ago",
    thumbnailUrl: undefined,
  },
  {
    projectName: "Partner Portal",
    pageCount: 12,
    publishStatus: "published" as const,
    lastModified: "1 week ago",
    thumbnailUrl: undefined,
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PageBuilderPage() {
  return (
    <div className="space-y-16 pb-20">
      <Breadcrumbs />

      <PageHeader
        title="Page Builder"
        description="spike.land's visual page builder lets users compose landing pages and content layouts by stacking blocks without writing code. Projects can be saved as drafts, scheduled for release, or published instantly."
        usage="Use PageBuilder components to display projects in a grid, show the drag-and-drop block palette, render a stacked canvas preview, and surface publish status with the toolbar."
      />

      <UsageGuide
        dos={[
          "Show PageProjectCard in a grid layout so users can scan multiple projects at a glance.",
          "Use the status badge colors consistently: yellow for draft, green for published, blue for scheduled.",
          "Render PageBlockPalette in a sidebar so it stays visible while editing the canvas.",
          "Display PagePublishToolbar at the top or bottom of the canvas to give clear publish affordance.",
          "Show lastSaved timestamp in the toolbar to reassure users their work is persisted.",
        ]}
        donts={[
          "Don't mix status badge colors with other contextual colors -- they carry semantic meaning.",
          "Avoid displaying an empty canvas without an empty state message guiding the user.",
          "Don't hide the block palette during active editing -- users need quick access to add blocks.",
          "Don't use PageCanvasPreview as a live editor -- it is read-only preview only.",
          "Avoid truncating project names beyond the card width without a tooltip fallback.",
        ]}
      />

      {/* Project Cards */}
      <ComponentSample
        title="Project Cards"
        description="Cards representing page builder projects. Each card shows a thumbnail placeholder, project name, page count, publish status badge, and last modified timestamp."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {mockProjects.map(project => (
            <PageProjectCard
              key={project.projectName}
              projectName={project.projectName}
              pageCount={project.pageCount}
              publishStatus={project.publishStatus}
              lastModified={project.lastModified}
              {...(project.thumbnailUrl !== undefined ? { thumbnailUrl: project.thumbnailUrl } : {})}
            />
          ))}
        </div>
      </ComponentSample>

      {/* Publish Toolbar — all 3 status variants */}
      <ComponentSample
        title="Publish Toolbar"
        description="Sticky toolbar showing the current publish status and a publish button. Three variants: draft (yellow), published (green), and scheduled (blue)."
      >
        <div className="space-y-3 w-full max-w-xl">
          <PagePublishToolbar
            status="draft"
            lastSaved="2 minutes ago"
            onPublish={() => undefined}
          />
          <PagePublishToolbar
            status="published"
            lastSaved="just now"
            onPublish={() => undefined}
          />
          <PagePublishToolbar
            status="scheduled"
            lastSaved="5 minutes ago"
            onPublish={() => undefined}
          />
        </div>
      </ComponentSample>

      {/* Block Palette */}
      <ComponentSample
        title="Block Palette"
        description="Grid of available block types. Each block shows an icon, label, and short description. Clicking a block triggers the onAdd callback."
      >
        <div className="w-full max-w-2xl">
          <PageBlockPalette blocks={mockBlocks} onAdd={() => undefined} />
        </div>
      </ComponentSample>

      {/* Canvas Preview */}
      <ComponentSample
        title="Canvas Preview"
        description="Stacked read-only preview of page blocks in authoring order. Each block type has a distinct visual placeholder: hero uses a gradient, image uses a dashed outline, CTA uses an accent background, and divider renders a horizontal rule."
      >
        <div className="w-full max-w-2xl">
          <PageCanvasPreview blocks={mockCanvasBlocks} />
        </div>
      </ComponentSample>

      {/* Empty canvas state */}
      <ComponentSample
        title="Empty Canvas State"
        description="When no blocks have been added the canvas displays a guidance message."
      >
        <div className="w-full max-w-2xl">
          <PageCanvasPreview blocks={[]} />
        </div>
      </ComponentSample>

      <AccessibilityPanel
        notes={[
          "PageBlockPalette items use role=\"button\" and tabIndex for keyboard navigation.",
          "Each palette item exposes aria-label=\"Add {label} block\" for screen readers.",
          "PageCanvasPreview is wrapped in role=\"region\" with a descriptive aria-label.",
          "Divider blocks use role=\"separator\" for semantic meaning.",
          "Status badges use both color and text labels so color-blind users are not excluded.",
          "PagePublishToolbar Publish button has an explicit aria-label for assistive technology.",
          "Thumbnail img elements include descriptive alt text derived from the project name.",
          "Missing thumbnails fall back to a decorative icon with aria-hidden=\"true\".",
          "Icon-only indicators (Clock, FileText) are marked aria-hidden with adjacent visible text.",
        ]}
      />

      <RelatedComponents currentId="page-builder" />
    </div>
  );
}

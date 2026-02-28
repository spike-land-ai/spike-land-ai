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
import { ContentStatusBadge } from "@/components/content-hub/ContentStatusBadge";
import { ContentPostCard } from "@/components/content-hub/ContentPostCard";
import { ContentEditorPreview } from "@/components/content-hub/ContentEditorPreview";
import { ContentMetricsRow } from "@/components/content-hub/ContentMetricsRow";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPosts = [
  {
    title: "Getting Started with Next.js 16 App Router",
    excerpt:
      "A comprehensive guide to building modern web applications with the Next.js App Router, covering layouts, loading states, and server components.",
    status: "published" as const,
    publishDate: "Feb 20, 2026",
    author: "Zoltan Erdos",
    category: "Tutorial",
    readTime: "8 min read",
  },
  {
    title: "Designing Scalable MCP Tool Architectures",
    excerpt:
      "How we built 120+ MCP tools at spike.land — patterns for organization, testing, and maintaining consistency across a large tool surface.",
    status: "draft" as const,
    author: "Zoltan Erdos",
    category: "Architecture",
    readTime: "12 min read",
  },
  {
    title: "WebSocket State Synchronization with Durable Objects",
    excerpt:
      "Deep dive into real-time collaboration patterns using Cloudflare Durable Objects for conflict-free state management across distributed clients.",
    status: "scheduled" as const,
    publishDate: "Mar 5, 2026",
    author: "Zoltan Erdos",
    category: "Engineering",
    readTime: "15 min read",
  },
  {
    title: "The TypeScript Strict Mode Migration Guide",
    excerpt:
      "Step-by-step process for enabling TypeScript strict mode in a large codebase without breaking existing functionality.",
    status: "archived" as const,
    publishDate: "Jan 10, 2026",
    author: "Zoltan Erdos",
    category: "TypeScript",
    readTime: "6 min read",
  },
];

const mockEditorContent = {
  title: "Getting Started with Next.js 16 App Router",
  content:
    `The Next.js App Router represents a fundamental shift in how we build React applications. By embracing React Server Components as the default, it enables a new paradigm where data fetching happens closer to where it's needed.

In this guide, we'll explore the core concepts: layouts, loading states, error boundaries, and server actions. Each of these features builds on the others to create a cohesive development experience.

Server components run exclusively on the server. They can directly access databases, file systems, and sensitive environment variables. This eliminates the traditional challenge of managing API routes for every data fetch operation.

The App Router's nested routing system lets you compose complex UIs from smaller layout fragments. Each segment of a URL can define its own layout, loading state, and error handling — dramatically reducing boilerplate.`,
  wordCount: 124,
};

const mockMetrics = [
  { views: 12400, comments: 87, shares: 341, likes: 892 },
  { views: 3200, comments: 14, shares: 56 },
  { views: 89000, comments: 412, shares: 2100, likes: 5430 },
];

// ---------------------------------------------------------------------------
// Code snippets
// ---------------------------------------------------------------------------

const codeSnippets = {
  statusBadge: `import { ContentStatusBadge } from "@/components/content-hub/ContentStatusBadge";

<ContentStatusBadge status="published" />
<ContentStatusBadge status="draft" />
<ContentStatusBadge status="scheduled" />
<ContentStatusBadge status="archived" />`,

  postCard: `import { ContentPostCard } from "@/components/content-hub/ContentPostCard";

<ContentPostCard
  title="Getting Started with Next.js 16 App Router"
  excerpt="A comprehensive guide to building modern web applications..."
  status="published"
  publishDate="Feb 20, 2026"
  author="Zoltan Erdos"
  category="Tutorial"
  readTime="8 min read"
/>`,

  editorPreview:
    `import { ContentEditorPreview } from "@/components/content-hub/ContentEditorPreview";

<ContentEditorPreview
  title="Getting Started with Next.js 16 App Router"
  content="The Next.js App Router represents a fundamental shift..."
  wordCount={124}
/>`,

  metricsRow: `import { ContentMetricsRow } from "@/components/content-hub/ContentMetricsRow";

<ContentMetricsRow
  views={12400}
  comments={87}
  shares={341}
  likes={892}
/>`,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContentHubPage() {
  return (
    <div className="space-y-16 pb-20">
      <Breadcrumbs />

      <PageHeader
        title="Content Hub"
        description="The Content Hub powers spike.land's publishing workflow — from draft creation through scheduling, publishing, and archival. Components handle status indicators, post previews, editor views, and engagement metrics."
        usage="Use Content Hub components for CMS dashboards, post listing pages, editor sidebars, and analytics panels. Combine ContentPostCard in grids for content browsing and ContentEditorPreview for read-only article rendering."
      />

      <UsageGuide
        dos={[
          "Use ContentStatusBadge consistently wherever post status appears.",
          "Display ContentMetricsRow below post content for engagement context.",
          "Show ContentEditorPreview for read-only rendering of published articles.",
          "Use ContentPostCard in a responsive grid for post listing pages.",
          "Always include status badge in ContentPostCard to help authors distinguish drafts from live content.",
        ]}
        donts={[
          "Don't use ContentEditorPreview as an actual editor — it is read-only.",
          "Avoid showing metrics on draft posts that have no real traffic data.",
          "Don't omit the status badge in admin views — it prevents accidental edits to published content.",
          "Avoid displaying raw word counts without the wordCount prop for consistent formatting.",
          "Don't stack more than 4 ContentPostCards in a single column on desktop — use a grid.",
        ]}
      />

      {/* Status Badges */}
      <ComponentSample
        title="Content Status Badges"
        description="Status badges indicate the lifecycle stage of a content item. Gray for draft, green for published, blue for scheduled, amber for archived."
      >
        <div className="flex items-center gap-4 flex-wrap">
          <ContentStatusBadge status="draft" />
          <ContentStatusBadge status="published" />
          <ContentStatusBadge status="scheduled" />
          <ContentStatusBadge status="archived" />
        </div>
      </ComponentSample>

      {/* Post Cards */}
      <ComponentSample
        title="Content Post Cards"
        description="Preview cards for blog posts and articles. Each card shows category, status badge, title, excerpt, author, read time, and publish date. Used in grid layouts for content dashboards and listing pages."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {mockPosts.map((post, i) => (
            <ContentPostCard
              key={i}
              title={post.title}
              excerpt={post.excerpt}
              status={post.status}
              {...(post.publishDate !== undefined ? { publishDate: post.publishDate } : {})}
              author={post.author}
              category={post.category}
              readTime={post.readTime}
            />
          ))}
        </div>
      </ComponentSample>

      {/* Editor Preview */}
      <ComponentSample
        title="Content Editor Preview"
        description="A read-only preview panel that renders article content with styled typography. Shows the title prominently, renders content as distinct paragraphs, and displays word count at the bottom."
      >
        <div className="w-full max-w-2xl">
          <ContentEditorPreview
            title={mockEditorContent.title}
            content={mockEditorContent.content}
            wordCount={mockEditorContent.wordCount}
          />
        </div>
      </ComponentSample>

      {/* Metrics Row */}
      <ComponentSample
        title="Content Metrics Row"
        description="A compact metrics row showing engagement stats with icons: views (Eye), comments (MessageSquare), shares (Share2), and optional likes (Heart). Numbers are formatted with K/M abbreviations."
      >
        <div className="space-y-6 w-full">
          {mockMetrics.map((metrics, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-zinc-800 bg-zinc-900"
            >
              <ContentMetricsRow
                views={metrics.views}
                comments={metrics.comments}
                shares={metrics.shares}
                {...(metrics.likes !== undefined ? { likes: metrics.likes } : {})}
              />
            </div>
          ))}
        </div>
      </ComponentSample>

      {/* Code Snippets */}
      <CodePreview
        code={codeSnippets.statusBadge}
        title="Content Hub Components"
        tabs={[
          { label: "ContentStatusBadge", code: codeSnippets.statusBadge },
          { label: "ContentPostCard", code: codeSnippets.postCard },
          { label: "ContentEditorPreview", code: codeSnippets.editorPreview },
          { label: "ContentMetricsRow", code: codeSnippets.metricsRow },
        ]}
      />

      <AccessibilityPanel
        notes={[
          "ContentStatusBadge uses both color and text label for colorblind accessibility.",
          "ContentMetricsRow metric items include aria-label attributes with full number and unit.",
          "ContentPostCard uses semantic card structure with appropriate heading levels.",
          "ContentEditorPreview renders content as paragraph elements for proper screen reader flow.",
          "Status badges use text labels alongside color to convey meaning without relying on color alone.",
          "Metric icons are decorative; values and labels convey the information independently.",
          "Number formatting (K/M) is supplemented by aria-label with exact values for assistive technology.",
        ]}
      />

      <RelatedComponents currentId="content-hub" />
    </div>
  );
}

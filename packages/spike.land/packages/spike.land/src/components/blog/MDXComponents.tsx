"use client";

import { TOTAL_TOOL_COUNT } from "@/components/mcp/mcp-tool-registry";
import { Link } from "@/components/ui/link";
import type { MDXComponents } from "mdx/types";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { ComponentPropsWithoutRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ImagePlaceholder } from "./ImagePlaceholder";
import { ReadAloudParagraph } from "./ReadAloudButton";

// Dynamic imports with SSR disabled to prevent React hooks errors during static generation
const ImageComparisonSlider = dynamic(
  () =>
    import("@/components/enhance/ImageComparisonSlider").then(
      mod => mod.ImageComparisonSlider,
    ),
  {
    ssr: false,
    loading: () => <div className="w-full aspect-square bg-muted animate-pulse rounded-lg" />,
  },
);

const SplitPreview = dynamic(
  () => import("@/components/enhance/SplitPreview").then(mod => mod.SplitPreview),
  {
    ssr: false,
    loading: () => <div className="w-full aspect-square bg-muted animate-pulse rounded-lg" />,
  },
);

/**
 * AudioPlayer component for embedding audio files with HTML5 audio player.
 * Provides a styled container with title and audio controls.
 *
 * @param src - The path to the audio file (relative to public directory)
 * @param title - Optional title to display above the player
 *
 * @example
 * ```mdx
 * <AudioPlayer src="/audio/podcast.m4a" title="Listen to this episode" />
 * ```
 */
function AudioPlayer({
  src,
  title,
}: {
  src: string;
  title?: string;
}) {
  return (
    <div className="my-8 p-6 bg-card rounded-xl border border-border">
      {title && (
        <h4 className="font-heading text-lg font-semibold mb-4 text-foreground">
          {title}
        </h4>
      )}
      <audio
        controls
        className="w-full"
        preload="metadata"
      >
        <source src={src} type="audio/mp4" />
        <source src={src} type="audio/x-m4a" />
        <track kind="captions" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}

/**
 * YouTubeEmbed component for embedding YouTube videos responsively.
 * Uses privacy-enhanced mode (youtube-nocookie.com) for better user privacy.
 *
 * @param videoId - The YouTube video ID (the part after ?v= in the URL)
 * @param title - Optional title for accessibility
 *
 * @example
 * ```mdx
 * <YouTubeEmbed videoId="dQw4w9WgXcQ" title="Example video" />
 * ```
 */
function YouTubeEmbed({
  videoId,
  title = "YouTube video",
}: {
  videoId: string;
  title?: string;
}) {
  // Basic validation to prevent XSS injection into the iframe src
  const safeVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    <div className="my-8 relative w-full aspect-video rounded-xl overflow-hidden border border-border">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${safeVideoId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute top-0 left-0 w-full h-full"
      />
    </div>
  );
}

/**
 * Callout component for displaying info, warning, or success messages in blog posts.
 * Renders a styled box with a colored left border based on the message type.
 *
 * @param type - The type of callout: "info" (blue), "warning" (yellow), or "success" (green)
 * @param children - The content to display inside the callout
 *
 * @example
 * ```mdx
 * <Callout type="info">
 *   This is an informational callout.
 * </Callout>
 * ```
 */
function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-primary/10 border-primary text-foreground",
    warning: "bg-warning border-warning text-foreground",
    success: "bg-success border-success text-foreground",
  };
  return (
    <div className={cn("border-l-4 p-4 my-6 rounded-r-lg", styles[type])}>
      {children}
    </div>
  );
}

/**
 * Gallery component for displaying multiple images in a responsive grid layout.
 * Images are displayed in a single column on mobile and two columns on larger screens.
 *
 * @param children - Image elements or other content to display in the gallery
 *
 * @example
 * ```mdx
 * <Gallery>
 *   <img src="/image1.jpg" alt="First image" />
 *   <img src="/image2.jpg" alt="Second image" />
 * </Gallery>
 * ```
 */
function Gallery({ children }: { children: React.ReactNode; }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">{children}</div>;
}

/**
 * Call-to-action button component for prominent links in blog posts.
 * Renders a centered, styled button with the Pixel cyan glow effect.
 *
 * @param href - The URL to navigate to when clicked
 * @param children - The button label text
 *
 * @example
 * ```mdx
 * <CTAButton href="/apps/pixel">Try Pixel Free</CTAButton>
 * ```
 */
function CTAButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-8 flex justify-center">
      <Button
        asChild
        size="lg"
        className="shadow-glow-cyan text-white no-underline"
      >
        <Link href={href} className="text-white no-underline">{children}</Link>
      </Button>
    </div>
  );
}

/**
 * Custom link component
 */
function CustomLink({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const isExternal = href?.startsWith("http");
  if (isExternal) {
    return (
      <a
        href={href}
        className="text-primary hover:underline transition-colors"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={href || "#"}
      className="text-primary hover:underline transition-colors"
      {...props}
    >
      {children}
    </Link>
  );
}

/**
 * Custom code component
 */
function CustomCode({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"code">) {
  const isInline = !className;
  if (isInline) {
    return (
      <code
        className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded"
        {...props}
      >
        {children}
      </code>
    );
  }
  return (
    <code className="font-mono text-sm" {...props}>
      {children}
    </code>
  );
}

/**
 * Custom image component
 */
function CustomImage({ src, alt }: { src?: string; alt?: string; }) {
  if (!src || typeof src !== "string") {
    return null;
  }
  return (
    <span className="block my-6">
      <Image
        src={src}
        alt={alt || ""}
        width={1200}
        height={675}
        className="rounded-lg w-full h-auto"
      />
    </span>
  );
}

/**
 * LiveDemo component for embedding live spike.land demos in blog posts.
 * Renders a styled iframe with a title bar and "Open in new tab" link.
 *
 * @param src - The full URL to the live demo
 * @param title - Optional title to display above the iframe
 * @param height - Optional height for the iframe (default "600px")
 *
 * @example
 * ```mdx
 * <LiveDemo src="https://spike.land/create/my-app" title="spike.land — Live Demo" />
 * ```
 */
function LiveDemo({
  src,
  title = "Live Demo",
  height = "600px",
}: {
  src: string;
  title?: string;
  height?: string;
}) {
  return (
    <div className="my-8 rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 bg-muted/50 border-b border-border">
        <h4 className="font-heading text-lg font-semibold text-foreground">
          {title}
        </h4>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline transition-colors"
        >
          Open in new tab
        </a>
      </div>
      <iframe
        src={src}
        title={title}
        style={{ height }}
        className="w-full border-0"
        allow="clipboard-write"
      />
    </div>
  );
}

/**
 * PDFViewer component for embedding PDF documents with an iframe.
 * Browsers handle PDF rendering natively; includes a download link as fallback.
 *
 * @param src - The path to the PDF file (relative to public directory)
 * @param title - Optional title to display above the viewer
 * @param height - Optional height for the iframe (default "800px")
 *
 * @example
 * ```mdx
 * <PDFViewer src="/docs/contract.pdf" title="Contract Extension" />
 * ```
 */
function PDFViewer({
  src,
  title,
  height = "800px",
}: {
  src: string;
  title?: string;
  height?: string;
}) {
  return (
    <div className="my-8 rounded-xl border border-border overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-6 py-3 bg-muted/50 border-b border-border">
          <h4 className="font-heading text-lg font-semibold text-foreground">
            {title}
          </h4>
          <a
            href={src}
            download
            className="text-sm text-primary hover:underline transition-colors"
          >
            Download PDF
          </a>
        </div>
      )}
      <iframe
        src={src}
        title={title || "PDF document"}
        style={{ height }}
        className="w-full border-0"
      />
      {!title && (
        <div className="px-6 py-3 bg-muted/50 border-t border-border">
          <a
            href={src}
            download
            className="text-sm text-primary hover:underline transition-colors"
          >
            Download PDF
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Custom components available in MDX blog posts
 * These override default HTML elements with styled versions
 */
export const mdxComponents: MDXComponents = {
  // Headings with Montserrat font
  h1: ({ children, ...props }: ComponentPropsWithoutRef<"h1">) => (
    <h1
      className="font-heading text-4xl font-bold mt-12 mb-6 text-foreground"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="font-heading text-3xl font-bold mt-10 mb-4 text-foreground"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: ComponentPropsWithoutRef<"h3">) => (
    <h3
      className="font-heading text-2xl font-semibold mt-8 mb-3 text-foreground"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }: ComponentPropsWithoutRef<"h4">) => (
    <h4
      className="font-heading text-xl font-semibold mt-6 mb-2 text-foreground"
      {...props}
    >
      {children}
    </h4>
  ),

  // Paragraphs with proper line height and read-aloud button
  // Uses <div> instead of <p> to avoid HTML nesting violations when MDX content
  // contains block-level elements (e.g., interactive components inside paragraphs)
  p: ({ children, ...props }: ComponentPropsWithoutRef<"p">) => (
    <ReadAloudParagraph>
      <div className="text-foreground leading-relaxed mb-6" {...props}>
        {children}
      </div>
    </ReadAloudParagraph>
  ),

  // Links with Pixel Cyan color
  a: CustomLink,

  // Lists
  ul: ({ children, ...props }: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className="list-disc list-inside space-y-2 mb-6 text-foreground"
      {...props}
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className="list-decimal list-inside space-y-2 mb-6 text-foreground"
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  ),

  // Blockquotes
  blockquote: ({
    children,
    ...props
  }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="border-l-4 border-primary pl-4 py-2 my-6 text-muted-foreground italic flex items-center min-h-[3rem]"
      {...props}
    >
      <div>{children}</div>
    </blockquote>
  ),

  // Code blocks
  pre: ({ children, ...props }: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="bg-card rounded-lg p-4 overflow-x-auto my-6 border border-border"
      {...props}
    >
      {children}
    </pre>
  ),
  code: CustomCode,

  // Horizontal rule
  hr: () => <hr className="my-8 border-border" />,

  // Strong/bold
  strong: ({ children, ...props }: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-bold text-foreground" {...props}>
      {children}
    </strong>
  ),

  // Emphasis/italic
  em: ({ children, ...props }: ComponentPropsWithoutRef<"em">) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),

  // Tables
  table: ({ children, ...props }: ComponentPropsWithoutRef<"table">) => (
    <div className="my-6 w-full overflow-x-auto">
      <table
        className="w-full border-collapse text-sm"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: ComponentPropsWithoutRef<"thead">) => (
    <thead className="bg-muted/50" {...props}>
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }: ComponentPropsWithoutRef<"tbody">) => (
    <tbody className="divide-y divide-border" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }: ComponentPropsWithoutRef<"tr">) => (
    <tr
      className="border-b border-border transition-colors hover:bg-muted/30"
      {...props}
    >
      {children}
    </tr>
  ),
  th: ({ children, ...props }: ComponentPropsWithoutRef<"th">) => (
    <th
      className="px-4 py-3 text-left font-semibold text-foreground border-b border-border"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: ComponentPropsWithoutRef<"td">) => (
    <td className="px-4 py-3 text-foreground" {...props}>
      {children}
    </td>
  ),

  // Images with Next.js Image component
  img: CustomImage,

  // Custom components for MDX
  ToolCount: () => <>{TOTAL_TOOL_COUNT}</>,
  ImageComparisonSlider,
  SplitPreview,
  Button,
  Callout,
  Gallery,
  CTAButton,
  ImagePlaceholder,
  AudioPlayer,
  YouTubeEmbed,
  PDFViewer,
  LiveDemo,
  SplitScreenDemo: dynamic(
    () => import("./interactive").then(mod => mod.SplitScreenDemo),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  AttentionSpotlightDemo: dynamic(
    () => import("./interactive").then(mod => mod.AttentionSpotlightDemo),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  FiveLayerStackDemo: dynamic(
    () => import("./interactive").then(mod => mod.FiveLayerStackDemo),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  DarwinianTreeDemo: dynamic(
    () => import("./interactive").then(mod => mod.DarwinianTreeDemo),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  RecursiveZoomDemo: dynamic(
    () => import("./interactive").then(mod => mod.RecursiveZoomDemo),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  ModelCascadeDemo: dynamic(
    () => import("./interactive").then(mod => mod.ModelCascadeDemo),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  BayesianConfidenceDemo: dynamic(
    () => import("./interactive").then(mod => mod.BayesianConfidenceDemo),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  MCPTerminalDemo: dynamic(
    () => import("./interactive").then(mod => mod.MCPTerminalDemo),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  ScrollStoryCard: dynamic(
    () => import("./interactive").then(mod => mod.ScrollStoryCard),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  MCPFlowDiagram: dynamic(
    () => import("./interactive").then(mod => mod.MCPFlowDiagram),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  PerspectiveCarousel: dynamic(
    () => import("./interactive").then(mod => mod.PerspectiveCarousel),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  SpikeCliDemo: dynamic(
    () => import("./interactive").then(mod => mod.SpikeCliDemo),
    {
      ssr: false,
      loading: () => 
      <div className="w-full aspect-video bg-muted animate-pulse rounded-xl my-16" />,
    },
  ),
  BlogPoll: dynamic(() => import("./BlogPoll").then(mod => mod.BlogPoll), {
    ssr: false,
    loading: () => <div className="w-full h-32 bg-muted animate-pulse rounded-xl my-8" />,
  }),
  PollAnalyticsDashboard: dynamic(
    () => import("./PollAnalyticsDashboard").then(mod => mod.PollAnalyticsDashboard),
    {
      ssr: false,
      loading: () => <div className="w-full h-64 bg-muted animate-pulse rounded-xl my-8" />,
    },
  ),
  PersonaLandingPreview: dynamic(
    () => import("./PersonaLandingPreview").then(mod => mod.PersonaLandingPreview),
    {
      ssr: false,
      loading: () => <div className="w-full h-48 bg-muted animate-pulse rounded-xl my-8" />,
    },
  ),
  PersonaSwitcher: dynamic(
    () => import("./PersonaSwitcher").then(mod => mod.PersonaSwitcher),
    {
      ssr: false,
      loading: () => <div className="w-full h-24 bg-muted animate-pulse rounded-xl my-8" />,
    },
  ),
};

/**
 * Returns MDX components with optional overrides.
 * Use this function to get the default MDX components with additional
 * or custom component implementations.
 *
 * @param overrides - Optional object of components to override or add
 * @returns The merged MDX components object
 *
 * @example
 * ```tsx
 * const components = getMDXComponents({
 *   CustomComponent: MyCustomComponent,
 * });
 * ```
 */
export function getMDXComponents(
  overrides: MDXComponents = {},
): MDXComponents {
  return {
    ...mdxComponents,
    ...overrides,
  };
}

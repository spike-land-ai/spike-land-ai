import { useState, useEffect, useCallback, lazy, Suspense, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { BlogPost } from "../core-logic/types";
import { apiUrl } from "../core-logic/api";
import {
  coerceBooleanProp,
  coerceNumberProp,
  parseStoryMappings,
  preprocessBlogMdx,
  stripLegacyPersonalizedBlogFraming,
} from "../core-logic/blog-mdx";
import {
  buildPromptDrivenBlogImageSrc,
  sanitizeBlogImageSrc,
} from "../core-logic/blog-image-policy";
import { extractHeroMedia } from "../core-logic/blog-source";
import { ScrollStoryCard } from "../animation-ui/ScrollStoryCard";
import { CodeBlock } from "./CodeBlock";
import { BlogListView } from "./BlogList";
import {
  AgentLoopDemo,
  AudioPlayer,
  BlogPoll,
  CTAButton,
  PersonaLandingPreview,
  PersonaSwitcher,
  PollAnalyticsDashboard,
  ToolCount,
} from "./BlogCompatComponents";
import { BlogReaderControls } from "./BlogReaderControls";
import { ImageLoader } from "./ImageLoader";
import { SpikeChatEmbed } from "./SpikeChatEmbed";
import { ExperimentProvider, useExperiment } from "./useExperiment";
import { useWidgetTracking } from "./useWidgetTracking";
import {
  ChevronLeft,
  Share2,
  Twitter,
  Linkedin,
  ArrowLeft,
  Heart,
  Coffee,
  Gift,
  Zap,
  Shield,
  FileWarning,
  Clock,
  Info,
  CheckCircle2,
  AlertTriangle,
  Tag,
  Copy,
  Check,
  Trophy,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "../lazy-imports/button";
import {
  cn,
  formatSupportAmount,
  isValidSupportAmount,
  normalizeSupportAmountInput,
  parseSupportAmount,
  SUPPORT_AMOUNT_MAX,
  SUPPORT_AMOUNT_MIN,
  SUPPORT_CURRENCY_SYMBOL,
  SUPPORT_MAGIC_AMOUNT,
} from "@spike-land-ai/shared";

const DemoFallback = () => (
  <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-[2rem] border border-border/60">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground/50">
      Initializing Demo...
    </p>
  </div>
);

function lazyDemo(
  load: () => Promise<Record<string, unknown>>,
  name: string,
): React.ComponentType<Record<string, unknown>> {
  const LazyComp = lazy(() =>
    load().then((mod) => ({ default: mod[name] as React.ComponentType<Record<string, unknown>> })),
  );
  return function LazyDemoWrapper(props: Record<string, unknown>) {
    return (
      <Suspense fallback={<DemoFallback />}>
        <div className="not-prose my-12 overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-[var(--panel-shadow)]">
          <LazyComp {...props} />
        </div>
      </Suspense>
    );
  };
}

const interactiveImport = () =>
  import("../core-logic/interactive-index") as Promise<Record<string, unknown>>;

function ScrollStoryCardCompat(props: Record<string, unknown>) {
  const illustration =
    props["illustration"] === "restaurant" ||
    props["illustration"] === "usb" ||
    props["illustration"] === "embassy" ||
    props["illustration"] === "brain"
      ? props["illustration"]
      : "restaurant";

  const mappings = parseStoryMappings(props["mappings"]);

  return (
    <div className="not-prose my-12 overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-[var(--panel-shadow)]">
      <ScrollStoryCard
        title={typeof props["title"] === "string" ? props["title"] : "Story Mapping"}
        illustration={illustration}
        {...(mappings !== undefined ? { mappings } : {})}
      />
    </div>
  );
}

function SpikeChatEmbedCompat(props: Record<string, unknown>) {
  const channelSlug =
    typeof props["channelSlug"] === "string"
      ? props["channelSlug"]
      : typeof props["channelslug"] === "string"
        ? props["channelslug"]
        : "blog";
  const workspaceSlug =
    typeof props["workspaceSlug"] === "string"
      ? props["workspaceSlug"]
      : typeof props["workspaceslug"] === "string"
        ? props["workspaceslug"]
        : "spike-land";
  const guestAccess =
    props["guestAccess"] !== undefined ? props["guestAccess"] : props["guestaccess"];
  const height = props["height"];
  const blogSlug =
    typeof props["blogSlug"] === "string"
      ? props["blogSlug"]
      : typeof props["blogslug"] === "string"
        ? props["blogslug"]
        : undefined;
  const blogTitle =
    typeof props["blogTitle"] === "string"
      ? props["blogTitle"]
      : typeof props["blogtitle"] === "string"
        ? props["blogtitle"]
        : undefined;
  const contentSnippet =
    typeof props["contentSnippet"] === "string"
      ? props["contentSnippet"]
      : typeof props["contentsnippet"] === "string"
        ? props["contentsnippet"]
        : undefined;
  const persona = typeof props["persona"] === "string" ? props["persona"] : undefined;

  return (
    <div className="not-prose my-12 overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-[var(--panel-shadow)]">
      <SpikeChatEmbed
        channelSlug={channelSlug}
        workspaceSlug={workspaceSlug}
        guestAccess={coerceBooleanProp(guestAccess)}
        height={coerceNumberProp(height, 500)}
        blogSlug={blogSlug}
        blogTitle={blogTitle}
        contentSnippet={contentSnippet}
        persona={persona}
      />
    </div>
  );
}

function ResponsiveIframe(props: React.IframeHTMLAttributes<HTMLIFrameElement>) {
  return (
    <div className="not-prose my-12 overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-[var(--panel-shadow)]">
      <div className="aspect-video">
        <iframe
          {...props}
          src={props.src}
          title={props.title ?? "Embedded media"}
          loading="lazy"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}

/**
 * Custom (non-HTML) components keyed by lowercase MDX tag name.
 * These are passed to react-markdown via a type assertion since the Components
 * type only covers keyof JSX.IntrinsicElements.
 */
const CUSTOM_COMPONENT_MAP: Record<string, React.ComponentType<Record<string, unknown>>> = {
  convergencedemo: lazyDemo(interactiveImport, "ConvergenceDemo"),
  dependencycascadedemo: lazyDemo(interactiveImport, "DependencyCascadeDemo"),
  stackcollapsedemo: lazyDemo(interactiveImport, "StackCollapseDemo"),
  agentcoordinationdemo: lazyDemo(interactiveImport, "AgentCoordinationDemo"),
  splitscreendemo: lazyDemo(interactiveImport, "SplitScreenDemo"),
  attentionspotlightdemo: lazyDemo(interactiveImport, "AttentionSpotlightDemo"),
  sharedoptimizationproblemdemo: lazyDemo(interactiveImport, "SharedOptimizationProblemDemo"),
  prefixinvalidationdemo: lazyDemo(interactiveImport, "PrefixInvalidationDemo"),
  contextwindowdesigndemo: lazyDemo(interactiveImport, "ContextWindowDesignDemo"),
  monolithantipatterndemo: lazyDemo(interactiveImport, "MonolithAntiPatternDemo"),
  multistagebuilddemo: lazyDemo(interactiveImport, "MultiStageBuildDemo"),
  focusedcontextdemo: lazyDemo(interactiveImport, "FocusedContextDemo"),
  practicalrulesdemo: lazyDemo(interactiveImport, "PracticalRulesDemo"),
  cacheawarebuildgraphdemo: lazyDemo(interactiveImport, "CacheAwareBuildGraphDemo"),
  fivelayerstackdemo: lazyDemo(interactiveImport, "FiveLayerStackDemo"),
  darwiniantreedemo: lazyDemo(interactiveImport, "DarwinianTreeDemo"),
  recursivezoomdemo: lazyDemo(interactiveImport, "RecursiveZoomDemo"),
  modelcascadedemo: lazyDemo(interactiveImport, "ModelCascadeDemo"),
  bayesianconfidencedemo: lazyDemo(interactiveImport, "BayesianConfidenceDemo"),
  mcpterminaldemo: lazyDemo(interactiveImport, "MCPTerminalDemo"),
  scrollstorycard: ScrollStoryCardCompat,
  mcpflowdiagram: lazyDemo(interactiveImport, "MCPFlowDiagram"),
  perspectivecarousel: lazyDemo(interactiveImport, "PerspectiveCarousel"),
  spikeclidemo: lazyDemo(interactiveImport, "SpikeCliDemo"),
  pyramidreshapedemo: lazyDemo(interactiveImport, "PyramidReshapeDemo"),
  testcodenamevenn: lazyDemo(interactiveImport, "TestCodeNameVenn"),
  hourglassmodeldemo: lazyDemo(interactiveImport, "HourglassModelDemo"),
  paradigmguilttimeline: lazyDemo(interactiveImport, "ParadigmGuiltTimeline"),
  effortinversiondemo: lazyDemo(interactiveImport, "EffortInversionDemo"),
  contextlayerbuilderdemo: lazyDemo(interactiveImport, "ContextLayerBuilderDemo"),
  whisper: lazyDemo(interactiveImport, "Whisper"),
  crescendo: lazyDemo(interactiveImport, "Crescendo"),
  scrollweight: lazyDemo(interactiveImport, "ScrollWeight"),
  typereveal: lazyDemo(interactiveImport, "TypeReveal"),
  glitchtext: lazyDemo(interactiveImport, "GlitchText"),
  codecategorizerquiz: lazyDemo(interactiveImport, "CodeCategorizerQuiz"),
  livecategorizer: lazyDemo(interactiveImport, "LiveCategorizer"),
  toolsbycategorygrid: lazyDemo(interactiveImport, "ToolsByCategoryGrid"),
  personalizedsupportbox: lazyDemo(interactiveImport, "PersonalizedSupportBox"),
  rentstorytoggle: lazyDemo(interactiveImport, "RentStoryToggle"),
  openaiendpointdemo: lazyDemo(interactiveImport, "OpenAIEndpointDemo"),
  spikechatembed: SpikeChatEmbedCompat,
  toolcount: ToolCount as React.ComponentType<Record<string, unknown>>,
  audioplayer: AudioPlayer as React.ComponentType<Record<string, unknown>>,
  ctabutton: CTAButton as React.ComponentType<Record<string, unknown>>,
  agentloopdemo: AgentLoopDemo as React.ComponentType<Record<string, unknown>>,
  personalandingpreview: PersonaLandingPreview as React.ComponentType<Record<string, unknown>>,
  personaswitcher: PersonaSwitcher as React.ComponentType<Record<string, unknown>>,
  blogpoll: BlogPoll as React.ComponentType<Record<string, unknown>>,
  pollanalyticsdashboard: PollAnalyticsDashboard as React.ComponentType<Record<string, unknown>>,
  tldr: ({ children, title }: { children?: React.ReactNode; title?: string }) => (
    <div
      data-reader-block="true"
      data-reader-kind="summary"
      className="bg-primary/[0.03] border-2 border-primary/10 rounded-[2rem] p-8 my-12 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
        <Zap size={80} className="text-primary" />
      </div>
      <h3 className="text-lg font-black uppercase tracking-[0.24em] mb-4 text-primary flex items-center gap-2">
        <Zap className="size-4" />
        {title ?? "The Quick Version"}
      </h3>
      <div className="text-foreground/80 font-medium space-y-3 leading-relaxed">{children}</div>
    </div>
  ),
  callout: ({ children, type }: { children?: React.ReactNode; type?: string }) => {
    const isInfo = type === "info" || !type;
    const isSuccess = type === "success";
    const isWarning = type === "warning";

    return (
      <div
        data-reader-block="true"
        data-reader-kind="callout"
        className={cn(
          "p-6 my-10 rounded-2xl border-l-4 shadow-sm",
          isInfo &&
            "bg-info/10 border-l-info-foreground border-y border-r border-info-foreground/20 text-info-foreground",
          isSuccess &&
            "bg-success/10 border-l-success-foreground border-y border-r border-success-foreground/20 text-success-foreground",
          isWarning &&
            "bg-warning/10 border-l-warning-foreground border-y border-r border-warning-foreground/20 text-warning-foreground",
        )}
      >
        <div className="flex gap-4">
          <div className="shrink-0 mt-1">
            {isInfo && <Info size={20} className="text-info-foreground" />}
            {isSuccess && <CheckCircle2 size={20} className="text-success-foreground" />}
            {isWarning && <AlertTriangle size={20} className="text-warning-foreground" />}
          </div>
          <div className="font-medium leading-relaxed italic">{children}</div>
        </div>
      </div>
    );
  },
} as Record<string, React.ComponentType<Record<string, unknown>>>;

/**
 * HTML element override components typed against react-markdown's Components.
 */
const HTML_COMPONENT_MAP = {
  pre: ({ children }) => <>{children}</>,
  code: CodeBlock as Components["code"],
  h2: ({ children, ...props }) => (
    <h2 data-reader-block="true" data-reader-kind="heading-2" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 data-reader-block="true" data-reader-kind="heading-3" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 data-reader-block="true" data-reader-kind="heading-4" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 data-reader-block="true" data-reader-kind="heading-5" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 data-reader-block="true" data-reader-kind="heading-6" {...props}>
      {children}
    </h6>
  ),
  p: ({ children, ...props }) => (
    <p
      data-reader-block="true"
      data-reader-kind="paragraph"
      className="text-lg text-muted-foreground leading-relaxed font-medium my-6"
      {...props}
    >
      {children}
    </p>
  ),
  li: ({ children, ...props }) => (
    <li
      data-reader-block="true"
      data-reader-kind="list-item"
      className="my-2 text-muted-foreground font-medium"
      {...props}
    >
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      data-reader-block="true"
      data-reader-kind="blockquote"
      className="border-l-4 border-primary/30 bg-primary/[0.02] py-6 px-8 rounded-r-3xl text-foreground font-bold italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  iframe: ResponsiveIframe,
  a: ({ children, href, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  img: ({ src, alt, ...rest }) => {
    const safeSrc = sanitizeBlogImageSrc(src);
    if (!safeSrc) return null;

    return (
      <div className="my-12">
        <img
          src={safeSrc}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          className="rounded-[2rem] shadow-[var(--panel-shadow)] border border-border/60 mx-auto transition-transform hover:scale-[1.01] duration-500"
          {...rest}
        />
        {alt && (
          <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground/40">
            {alt}
          </p>
        )}
      </div>
    );
  },
} as Components;

/**
 * Merged component map passed to react-markdown. Custom (non-HTML) component
 * names are asserted to Components since react-markdown passes unknown tags
 * through to their registered handler when rehype-raw is active.
 */
const COMPONENT_MAP = {
  ...CUSTOM_COMPONENT_MAP,
  ...HTML_COMPONENT_MAP,
} as Components;

function normalizeBlogPost(post: BlogPost): BlogPost {
  const { heroImage, heroPrompt, body } = extractHeroMedia(
    post.content,
    post.heroImage,
    post.heroPrompt,
  );

  return {
    ...post,
    heroImage,
    heroPrompt,
    content: body,
  };
}

export function BlogPostView({
  slug,
  linkComponent,
  postOverride = null,
  skipFetch = false,
  loadingOverride = false,
}: {
  slug: string;
  linkComponent?:
    | React.ComponentType<{ to: string; className?: string; children: React.ReactNode }>
    | "a"
    | undefined;
  postOverride?: BlogPost | null;
  skipFetch?: boolean;
  loadingOverride?: boolean;
}) {
  const normalizedPostOverride = postOverride ? normalizeBlogPost(postOverride) : null;
  const [post, setPost] = useState<BlogPost | null>(normalizedPostOverride);
  const [loading, setLoading] = useState(!postOverride && !skipFetch);
  const [error, setError] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isHeroExpanded, setIsHeroExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const readerScopeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      setScrollProgress(scrolled);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (normalizedPostOverride) {
      setPost(normalizedPostOverride);
      setLoading(false);
      setError(false);
      return;
    }

    if (skipFetch) {
      setPost(null);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);
    fetch(apiUrl(`/blog/${slug}`))
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json() as Promise<BlogPost>;
      })
      .then((data) => setPost(normalizeBlogPost(data)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [normalizedPostOverride, skipFetch, slug]);

  const resolvedPost = normalizedPostOverride ?? post;

  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = existing?.content ?? null;

    if (!resolvedPost?.unlisted) {
      if (existing && existing.content === "noindex") {
        existing.content = "index, follow";
      }
      return;
    }

    const meta = existing ?? document.createElement("meta");
    if (!existing) {
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex";

    return () => {
      if (!existing) {
        meta.remove();
        return;
      }
      existing.content = previous ?? "index, follow";
    };
  }, [resolvedPost?.unlisted]);

  if (loading || loadingOverride) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-6 animate-pulse space-y-12">
        <div className="space-y-6">
          <div className="h-4 bg-muted rounded w-24 mx-auto" />
          <div className="h-16 bg-muted rounded-[2rem] w-full" />
          <div className="h-6 bg-muted rounded w-2/3 mx-auto" />
        </div>
        <div className="aspect-[21/9] bg-muted rounded-[3rem]" />
        <div className="space-y-4 pt-12">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-4 bg-muted rounded w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !resolvedPost) {
    return (
      <div className="max-w-xl mx-auto py-32 px-6 text-center">
        <div className="inline-flex size-20 items-center justify-center rounded-[2rem] bg-destructive/5 text-destructive mb-8">
          <FileWarning size={40} />
        </div>
        <h1 className="text-4xl font-black text-foreground tracking-tighter mb-4 leading-none">
          Story missing in action
        </h1>
        <p className="text-muted-foreground mb-10 text-lg">
          We couldn't find the blog post you're looking for. It might have been archived or moved.
        </p>
        <a
          href="/blog"
          className={cn(buttonVariants({ variant: "default" }), "rounded-2xl px-8 font-bold")}
        >
          <ArrowLeft className="mr-2 size-4" />
          Back to All Stories
        </a>
      </div>
    );
  }

  const cleanContent = resolvedPost.content.replace(
    /!\[[^\]]*\]\(https:\/\/placehold\.co\/[^)]+\)\n?/g,
    "",
  );
  const processedContent = preprocessBlogMdx(stripLegacyPersonalizedBlogFraming(cleanContent));
  const safeHeroImage = sanitizeBlogImageSrc(resolvedPost.heroImage);
  const heroImageSrc = buildPromptDrivenBlogImageSrc(safeHeroImage, resolvedPost.heroPrompt);

  return (
    <ExperimentProvider>
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1.5 z-[100] bg-transparent">
        <div
          className="h-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)] transition-all duration-100"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <article className="max-w-4xl mx-auto py-12 px-6 font-sans">
        <div className="mb-12 flex items-center justify-between">
          <a
            href="/blog"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "rounded-xl text-muted-foreground font-bold hover:text-primary group",
            )}
          >
            <ChevronLeft className="mr-1 size-4 transition-transform group-hover:-translate-x-1" />
            Stories
          </a>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl text-muted-foreground hover:text-foreground"
            >
              <Share2 size={18} />
            </Button>
          </div>
        </div>

        {safeHeroImage && (
          <>
            <motion.div
              layoutId={`hero-image-${slug}`}
              className="mb-16 rounded-[3rem] overflow-hidden shadow-[var(--panel-shadow)] ring-1 ring-border/5 cursor-zoom-in group"
              onClick={() => setIsHeroExpanded(true)}
            >
              <ImageLoader
                src={safeHeroImage}
                prompt={resolvedPost.heroPrompt}
                alt={resolvedPost.title}
                width={1200}
                height={514}
                loading="eager"
                decoding="async"
                wrapperClassName="w-full"
                className="w-full aspect-[21/9] object-cover"
              />
            </motion.div>
            <AnimatePresence>
              {isHeroExpanded && heroImageSrc && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-xl cursor-zoom-out p-4 sm:p-8"
                  onClick={() => setIsHeroExpanded(false)}
                >
                  <motion.img
                    layoutId={`hero-image-${slug}`}
                    src={heroImageSrc}
                    alt={resolvedPost.title}
                    className="max-w-full max-h-full rounded-2xl shadow-[var(--panel-shadow)] object-contain"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        <BlogReaderControls contentKey={resolvedPost.slug} scopeRef={readerScopeRef} />

        <div ref={readerScopeRef} data-reader-surface="true">
          <header className="mb-16 max-w-3xl mx-auto space-y-8">
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/10">
                <Tag size={12} />
                <span>{resolvedPost.category}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} />
                <time dateTime={resolvedPost.date}>
                  {new Date(resolvedPost.date).toLocaleDateString([], {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
            </div>

            <h1
              data-reader-block="true"
              data-reader-kind="title"
              className="text-5xl sm:text-7xl font-black text-foreground tracking-tighter leading-[0.85] text-balance"
            >
              {resolvedPost.title}
            </h1>

            {resolvedPost.primer && (
              <p
                data-reader-block="true"
                data-reader-kind="primer"
                className="text-xl sm:text-2xl text-muted-foreground/80 font-medium leading-relaxed italic border-l-4 border-primary/20 pl-6"
              >
                "{resolvedPost.primer}"
              </p>
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-border/60">
              <div className="size-10 rounded-2xl bg-primary flex items-center justify-center text-xs font-black text-primary-foreground shadow-lg shadow-primary/20">
                {resolvedPost.author?.[0] || "S"}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-foreground">
                  {resolvedPost.author || "Spike land Team"}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                  Independent Developer & Researcher
                </p>
              </div>
            </div>

            {/* Hashtags */}
            {resolvedPost.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4">
                {resolvedPost.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-full bg-primary/[0.06] border border-primary/10 text-[10px] font-black uppercase tracking-[0.24em] text-primary/70 hover:bg-primary/10 hover:text-primary transition-colors cursor-default select-none"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Social Share Bar */}
            {(() => {
              const shareUrl = `https://spike.land/blog/${resolvedPost.slug}`;
              const shareTitle = resolvedPost.title;
              const xShareIntent = `https://x.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`;
              const liShareIntent = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
              const redditIntent = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`;
              const hnIntent = `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(shareUrl)}&t=${encodeURIComponent(shareTitle)}`;
              const sharePillClass =
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border/60 bg-muted/30 text-xs font-bold text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all";
              return (
                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-border/30">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/40">
                    Share
                  </span>
                  <a
                    href={xShareIntent}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={sharePillClass}
                  >
                    <Twitter size={14} /> X
                  </a>
                  <a
                    href={liShareIntent}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={sharePillClass}
                  >
                    <Linkedin size={14} /> LinkedIn
                  </a>
                  <a
                    href={redditIntent}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={sharePillClass}
                  >
                    Reddit
                  </a>
                  <a
                    href={hnIntent}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={sharePillClass}
                  >
                    HN
                  </a>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(shareUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={sharePillClass}
                  >
                    {copied ? (
                      <>
                        <Check size={14} /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Link
                      </>
                    )}
                  </button>
                </div>
              );
            })()}
          </header>

          <div
            className="prose max-w-3xl mx-auto font-sans
          prose-headings:font-semibold prose-headings:text-foreground prose-headings:tracking-[-0.05em]
          prose-h1:text-4xl prose-h1:sm:text-5xl prose-h1:mb-6
          prose-h2:text-2xl prose-h2:sm:text-3xl prose-h2:mt-12 prose-h2:mb-4
          prose-h3:text-xl prose-h3:sm:text-2xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-[0.97rem] prose-p:leading-8 prose-p:text-foreground/90
          prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline
          prose-strong:text-foreground prose-strong:font-semibold
          prose-blockquote:my-5 prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:bg-transparent prose-blockquote:py-0 prose-blockquote:px-4 prose-blockquote:rounded-none prose-blockquote:text-muted-foreground prose-blockquote:font-normal prose-blockquote:italic
          prose-code:rounded-md prose-code:border prose-code:border-border prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono prose-code:text-primary prose-code:before:content-none prose-code:after:content-none
          [&_.shiki-container]:my-6 [&_.shiki-container]:overflow-x-auto [&_.shiki-container]:rounded-[calc(var(--radius-panel)-0.2rem)] [&_.shiki-container]:border [&_.shiki-container]:border-border [&_.shiki-container]:bg-muted/60 [&_.shiki-container]:p-4 [&_.shiki-container_code]:bg-transparent [&_.shiki-container_code]:p-0 [&_.shiki-container_code]:text-sm [&_.shiki-container_code]:font-normal [&_.shiki-container_.shiki]:!bg-transparent
          prose-pre:my-6 prose-pre:overflow-x-auto prose-pre:rounded-[calc(var(--radius-panel)-0.2rem)] prose-pre:border prose-pre:border-border prose-pre:bg-muted/60 prose-pre:p-4
          prose-li:text-foreground/90 prose-li:leading-8
          prose-ul:list-disc prose-ol:list-decimal
          prose-img:rounded-[2rem] prose-img:border prose-img:border-border prose-img:shadow-[var(--panel-shadow)]
          prose-hr:border-border/60
          selection:bg-primary selection:text-primary-foreground"
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={COMPONENT_MAP}
            >
              {processedContent}
            </Markdown>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <SupportWidget post={resolvedPost} />
        </div>

        <div className="max-w-3xl mx-auto">
          <SpikeChatEmbed
            blogSlug={resolvedPost.slug}
            blogTitle={resolvedPost.title}
            contentSnippet={processedContent?.slice(0, 2000)}
            persona="rubik-3"
            height={480}
          />
        </div>

        <div className="mt-32 pt-16 border-t border-border/60">
          <h2 className="text-3xl font-black tracking-tight text-center mb-16">Continue Reading</h2>
          <BlogListView linkComponent={linkComponent} limit={3} showHeader={false} />
        </div>
      </article>
    </ExperimentProvider>
  );
}

// ─── Support Widget ─────────────────────────────────────────────────────────

interface SliderStop {
  readonly amount: number;
  readonly label: string;
  readonly sub: string;
  readonly icon: LucideIcon | typeof Zap;
}

interface HumorRound {
  readonly heading: string;
  readonly subtext: string;
  readonly stops: readonly SliderStop[];
  readonly exitTitle?: string;
  readonly exitBody?: string;
  readonly exitDismiss?: string;
  readonly exitStay?: string;
  readonly animation?: "shake" | "bounce" | "pulse" | "grow" | "flip" | "confetti";
  readonly darkMode?: boolean;
}

const BASE_STOPS: readonly SliderStop[] = [
  { amount: 0, label: "Moral support", sub: "Keep building awesome stuff!", icon: Heart },
  { amount: 1, label: "A tiny coffee", sub: "Fuel for the next MCP tool.", icon: Coffee },
  { amount: 5, label: "Workers month", sub: "Covers Cloudflare Workers for a month.", icon: Zap },
  {
    amount: 10,
    label: "Infra buffer",
    sub: "Keeps two months of Workers paid ahead.",
    icon: Shield,
  },
  { amount: 25, label: "Growth Fund", sub: "Help us build more complex agents.", icon: Shield },
  { amount: 100, label: "Legend Tier", sub: "We will name a variable after you.", icon: Gift },
  {
    amount: 420,
    label: "Thinking mode: extra high",
    sub: "Anything between £411 and £429 gets pulled back here on principle.",
    icon: Gift,
  },
];

function makeStops(
  overrides: Partial<Record<number, { label: string; sub: string }>>,
): readonly SliderStop[] {
  return BASE_STOPS.map((stop) => {
    const override = overrides[stop.amount];
    return override ? { ...stop, ...override } : stop;
  });
}

const HUMOR_ROUNDS: readonly HumorRound[] = [
  // Round 0 — Default
  {
    heading: "Support the Journey",
    subtext:
      "Independent development is a labor of love. No VC funding, no bloated team, just code, mass-produced coffee, and a monthly Cloudflare bill. £5 covers Cloudflare Workers for a month. If you find value in these tools, consider supporting the journey.",
    stops: BASE_STOPS,
  },
  // Round 1 — Slider touched
  {
    heading: "Support the Journey",
    subtext: "You touched the slider. The slider felt that. Now you owe it at least a coffee.",
    stops: makeStops({
      0: { label: "Free-tier freeloader", sub: "We still love you. Allegedly." },
      1: { label: "A coffee bean", sub: "Not even a full coffee, but it is honest work." },
    }),
  },
  // Round 2 — Custom toggled
  {
    heading: "Oh, Going Custom?",
    subtext:
      "Big spender energy. We respect the power move. Or is this a power move to type zero? We see you.",
    stops: makeStops({
      0: { label: "Custom zero?", sub: "You went custom... to give nothing. Iconic." },
    }),
  },
  // Round 3 — Slider at zero
  {
    heading: "The Audacity",
    subtext:
      "You scrolled all the way down, read this whole widget, and chose... zero. Respect, honestly. That takes commitment.",
    stops: makeStops({
      0: {
        label: "Professional lurker",
        sub: "Some people support with their presence. Allegedly.",
      },
      1: { label: "Guilt tax", sub: "The minimum price of reading this far." },
    }),
    animation: "shake",
  },
  // Round 4 — First scroll away
  {
    heading: "You Came Back!",
    subtext:
      "The widget noticed you tried to leave. The widget has feelings. Serverless feelings, but feelings nonetheless.",
    stops: makeStops({
      0: { label: "Heartless", sub: "You tried to leave without saying goodbye." },
      5: { label: "Apology coffee", sub: "Less than your Spotify. Think about that." },
    }),
    exitTitle: "Wait, Where Are You Going?",
    exitBody:
      "The widget noticed you leaving. The widget has feelings. Cold-start feelings, but real ones.",
    exitDismiss: "I have no feelings either",
    exitStay: "Fine, I'll look at it",
    animation: "bounce",
  },
  // Round 5 — Second exit
  {
    heading: "Still Here? Good.",
    subtext:
      "Look, we get it. Free is a great price. But Cloudflare Workers cost actual money. Not a lot. But more than zero.",
    stops: makeStops({
      0: {
        label: "Professional mooch",
        sub: "You've spent more calories scrolling than £1 costs.",
      },
      5: { label: "Workers month", sub: "Fun fact: this costs less than your Spotify." },
      10: { label: "Two months of peace", sub: "The widget promises to chill for two months." },
    }),
    exitTitle: "Seriously Though",
    exitBody:
      "Cloudflare Workers cost real money. Not a lot, but more than the zero pounds you've contributed. We checked.",
    exitDismiss: "My contribution is intellectual",
    exitStay: "Ok guilt works on me",
  },
  // Round 6 — Third exit
  {
    heading: "The Widget Persists",
    subtext:
      "Every time you close this widget, a serverless function somewhere loses its cold start. Think of the functions. They have families (child processes).",
    stops: makeStops({
      0: { label: "Monster", sub: "You looked a widget in the eye and said no. Three times." },
      1: { label: "Function saver", sub: "Save a cold start. Be a hero." },
      25: { label: "Serious supporter", sub: "At this point we'd name a variable after you." },
    }),
    exitTitle: "We've Prepared a Guilt Trip",
    exitBody:
      "Every time you close this widget, a serverless function loses its cold start. Think of the functions. They have child processes.",
    exitDismiss: "Let them suffer",
    exitStay: "Save the functions",
    animation: "pulse",
  },
  // Round 7 — Fourth exit
  {
    heading: "A Quick Math Problem",
    subtext:
      "You've now spent approximately 47 seconds on this widget. At minimum wage, that's about 22p. You could have donated 22p by now. Just saying.",
    stops: makeStops({
      0: { label: "Time waster", sub: "Your time is worth less than £1, apparently." },
      1: { label: "22p rounded up", sub: "The mathematical guilt minimum." },
      100: {
        label: "Absolute unit",
        sub: "We will name a variable after you. A good one. Not temp.",
      },
    }),
    exitTitle: "Employee of the Month",
    exitBody:
      "You've spent more time dismissing this widget than it would take to donate £1. Your time is worth less than £1, apparently. We did the math.",
    exitDismiss: "Correct",
    exitStay: "My time IS worth something",
  },
  // Round 8 — Fifth exit (widget grows)
  {
    heading: "The Widget Has Evolved",
    subtext:
      "It learned from your rejections. It is stronger now. Bigger. You cannot close what you do not understand.",
    stops: makeStops({
      0: { label: "Still zero?", sub: "The widget grew and you still said no. Bold." },
      5: {
        label: "Edge computing",
        sub: "A month of edge computing. At the edge of your generosity.",
      },
      100: {
        label: "Legend Tier",
        sub: "We will name a Durable Object after you. It will outlive us all.",
      },
      420: { label: "Transcendence", sub: "The widget achieves final form." },
    }),
    exitTitle: "The Widget Has Evolved",
    exitBody:
      "It learned from your rejections. It is stronger now. You cannot close what you do not understand. It has grown. Literally.",
    exitDismiss: "I understand perfectly",
    exitStay: "What is happening",
    animation: "grow",
  },
  // Round 9 — Sixth exit
  {
    heading: "Let's Negotiate",
    subtext:
      "What if we lower the minimum? What about 1 penny? We don't actually accept pennies. But the thought counts. Does it though? No. Give us a pound.",
    stops: makeStops({
      0: { label: "Not even a penny", sub: "We asked for a penny and you said no." },
      1: { label: "One pound coin", sub: "8.75 grams of guilt relief." },
      25: {
        label: "Agent architect",
        sub: "You're funding the next AI agent. It will remember this.",
      },
    }),
    exitTitle: "Let's Negotiate",
    exitBody:
      "What if we lower the minimum? What about 1 penny? We don't actually accept pennies, but the thought counts. Does it? No. Give us a pound.",
    exitDismiss: "Not even a thought",
    exitStay: "Pennies are currency",
  },
  // Round 10 — Seventh exit (poem)
  {
    heading: "Poetry Corner",
    subtext:
      "The widget has been workshopping some material. It's not great. But it's trying harder than you are.",
    stops: makeStops({
      0: { label: "Critic", sub: "You rejected the poem AND the donation. Cold." },
      5: { label: "Five pounds of forgiveness", sub: "Enough to forgive bad poetry." },
      10: {
        label: "Infrastructure peace treaty",
        sub: "A binding agreement between you and the servers.",
      },
    }),
    exitTitle: "The Widget Wrote You a Poem",
    exitBody:
      "Roses are red, Workers are blue, this project is free, but the infra is not, and I really thought we had something.",
    exitDismiss: "Terrible poem",
    exitStay: "I'm emotionally moved",
    animation: "flip",
  },
  // Round 11 — Eighth exit (dark mode)
  {
    heading: "Dark Mode Unlocked",
    subtext:
      "You've been here so long the widget switched to its evening aesthetic. It's getting late. Go home. But first, consider £5. Please.",
    stops: makeStops({
      0: { label: "Night owl cheapskate", sub: "Even vampires tip their bartenders." },
      5: { label: "£5 at midnight", sub: "Decisions made at night are the bravest." },
      100: { label: "You are the main character", sub: "The widget's whole arc was about you." },
    }),
    exitTitle: "Unlocked: Dark Mode Widget",
    exitBody:
      "You've been here so long the widget switched to its evening aesthetic. It's getting late. Go home. But first, consider £5.",
    exitDismiss: "It's always dark in my heart",
    exitStay: "£5? Maybe.",
    darkMode: true,
  },
  // Round 12 — Ninth exit (boss fight)
  {
    heading: "Boss Fight",
    subtext:
      "This is the final form. We promise. (We are lying.) You've shown incredible dedication to not paying for things. We admire that, in a way.",
    stops: makeStops({
      0: {
        label: "Final boss defeated you",
        sub: "You beat the boss by... not paying. Unconventional.",
      },
      25: {
        label: '"I dismissed this 8 times" redemption',
        sub: "The redemption arc no one asked for.",
      },
      420: { label: "Widget enlightenment", sub: "Beyond money. Beyond reason. Just vibes." },
    }),
    exitTitle: "Boss Fight: Final Widget",
    exitBody:
      "This is the last dialog. We promise. (We are lying.) You've shown incredible dedication to not paying for things. We admire that, in a way.",
    exitDismiss: "You admire me?",
    exitStay: "Flattery works",
    animation: "confetti",
  },
  // Round 13 — Tenth exit
  {
    heading: "Fun Facts",
    subtext:
      "Did you know that a single £1 coin weighs 8.75 grams? That's lighter than the guilt you should be feeling. Also lighter than this widget, which keeps getting heavier with disappointment.",
    stops: makeStops({
      0: { label: "Absolute legend of cheapness", sub: "We're not even mad. We're impressed." },
      1: {
        label: "8.75 grams of generosity",
        sub: "Lighter than a hamster. Heavier than your conscience.",
      },
    }),
    exitTitle: "We Lied, There's More",
    exitBody:
      "Remember when we said that was the last one? Good times. A single £1 coin weighs 8.75 grams. That's lighter than the guilt you should be feeling.",
    exitDismiss: "Guilt weighs nothing",
    exitStay: "8.75 grams of support",
  },
  // Round 14 — Eleventh exit (tired widget)
  {
    heading: "Almost There",
    subtext:
      "The widget is tired. You're probably tired. We've both been through a lot. One pound. Just one. That's all. Please. We're begging.",
    stops: makeStops({
      0: { label: "Heartless AND tireless", sub: "You've outlasted the widget. Congratulations?" },
      1: { label: "Minimum viable guilt relief", sub: "One pound. One. Uno. Eins. Un." },
      5: { label: "Five pounds of mercy", sub: "Put the widget out of its misery." },
    }),
    exitTitle: "The Widget is Tired",
    exitBody:
      "Look, we've both been at this a while. The widget is tired. You're probably tired. One pound. Just one. Please.",
    exitDismiss: "Let the widget rest",
    exitStay: "One pound, fine, FINE",
  },
  // Round 15 — Final round (survivor)
  {
    heading: "You Won",
    subtext:
      "Achievement unlocked: Immovable Object. You've dismissed this widget 12 times. You are officially the most stubborn person on the internet. The widget concedes. But it will remember.",
    stops: makeStops({
      0: { label: "Trophy unlocked", sub: "You earned this by giving us nothing. Beautiful." },
      1: { label: "Victory lap donation", sub: "Winners sometimes tip. Just saying." },
      420: { label: "Plot twist ending", sub: "The ultimate power move after 15 rounds of no." },
    }),
    exitTitle: "Achievement Unlocked: Immovable Object",
    exitBody:
      "You've dismissed this widget 12 times. You are the most stubborn person on the internet. We give up. The widget concedes. But know this: it will remember.",
    exitDismiss: "I accept my trophy",
    exitStay: "Wait, I feel bad now",
    animation: "confetti",
  },
];

function getClientId(): string {
  const key = "spike_client_id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function readStoredRound(slug: string): number {
  try {
    const val = localStorage.getItem(`spike_support_round_${slug}`);
    return val ? Math.min(parseInt(val, 10) || 0, HUMOR_ROUNDS.length - 1) : 0;
  } catch {
    return 0;
  }
}

function storeRound(slug: string, round: number): void {
  try {
    localStorage.setItem(`spike_support_round_${slug}`, String(round));
  } catch {
    /* best-effort */
  }
}

function isWidgetSurvivor(slug: string): boolean {
  try {
    return localStorage.getItem(`spike_widget_survivor_${slug}`) === "1";
  } catch {
    return false;
  }
}

function setWidgetSurvivor(slug: string): void {
  try {
    localStorage.setItem(`spike_widget_survivor_${slug}`, "1");
  } catch {
    /* best-effort */
  }
}

const ANIMATION_CLASSES: Record<string, string> = {
  shake: "animate-[shake_0.5s_ease-in-out]",
  bounce: "animate-bounce",
  pulse: "animate-pulse",
  grow: "scale-110 transition-transform duration-700",
  flip: "animate-[flip_0.6s_ease-in-out]",
  confetti: "",
};

function ConfettiEffect() {
  const particles = Array.from({ length: 24 }, (_, i) => i);
  const colors = ["#f43f5e", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ec4899"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      {particles.map((i) => {
        const style: Record<string, string> = {
          left: `${Math.random() * 100}%`,
          top: "-8px",
          backgroundColor: colors[i % colors.length] ?? "#f43f5e",
          animationDelay: `${Math.random() * 0.5}s`,
          "--confetti-x": `${(Math.random() - 0.5) * 200}px`,
          "--confetti-r": `${Math.random() * 720 - 360}deg`,
        };
        return (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-[confetti_1.5s_ease-out_forwards]"
            style={style as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

function SupportWidget({ post }: { post: BlogPost }) {
  const slug = post.slug;
  const url = `https://spike.land/blog/${slug}`;
  const xIntent = `https://x.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(url)}`;
  const linkedInIntent = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const { assignments, config } = useExperiment();
  const { widgetRef, track } = useWidgetTracking(slug, assignments);

  const [round, setRound] = useState(() => readStoredRound(slug));
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [survivor, setSurvivor] = useState(() => isWidgetSurvivor(slug));
  const [sliderTouched, setSliderTouched] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const [sliderIdx, setSliderIdx] = useState(config.defaultSliderIdx);
  const [customAmount, setCustomAmount] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [bumped, setBumped] = useState(false);
  const [bumpCount, setBumpCount] = useState(0);
  const [supporters, setSupporters] = useState(0);
  const [bumpAnimating, setBumpAnimating] = useState(false);
  const [donating, setDonating] = useState(false);

  const currentRound: HumorRound = HUMOR_ROUNDS[round] ?? (HUMOR_ROUNDS[0] as HumorRound);
  const stops = currentRound.stops;
  const currentStop: SliderStop = stops[sliderIdx] ?? (stops[0] as SliderStop);
  const parsedCustomAmount = showCustom ? parseSupportAmount(customAmount) : null;
  const selectedAmount = showCustom ? parsedCustomAmount : currentStop.amount;
  const displayAmount = showCustom
    ? customAmount === ""
      ? "0"
      : parsedCustomAmount === null
        ? customAmount
        : formatSupportAmount(parsedCustomAmount)
    : formatSupportAmount(currentStop.amount);
  const displayLabel = showCustom
    ? parsedCustomAmount === SUPPORT_MAGIC_AMOUNT
      ? "Thinking mode: extra high"
      : "Custom amount"
    : currentStop.label;
  const displaySub = showCustom
    ? parsedCustomAmount === SUPPORT_MAGIC_AMOUNT
      ? "Anything from £411 to £429 resolves to £420."
      : "Dial in your own number if the presets are not quite right."
    : currentStop.sub;
  const DisplayIcon = showCustom
    ? parsedCustomAmount === SUPPORT_MAGIC_AMOUNT
      ? Gift
      : Heart
    : currentStop.icon;
  const canDonate = isValidSupportAmount(selectedAmount);

  const advanceRound = useCallback(
    (to?: number) => {
      setRound((prev) => {
        const next = to !== undefined ? to : Math.min(prev + 1, HUMOR_ROUNDS.length - 1);
        storeRound(slug, next);
        track("humor_round_advance", { from: prev, to: next });
        return next;
      });
    },
    [slug, track],
  );

  // Trigger confetti for confetti rounds
  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(`spike_bumped_${slug}`)) setBumped(true);
    } catch {
      /* best-effort */
    }
  }, [slug]);

  useEffect(() => {
    fetch(apiUrl(`/support/engagement/${encodeURIComponent(slug)}`))
      .then((r) => (r.ok ? (r.json() as Promise<{ fistBumps: number; supporters: number }>) : null))
      .then((data) => {
        if (data) {
          setBumpCount(data.fistBumps);
          setSupporters(data.supporters);
        }
      })
      .catch(() => {});
  }, [slug]);

  // Exit detection: when widget leaves viewport after round >= 3
  useEffect(() => {
    const element = widgetRef.current;
    if (!element || round < 3) return;

    let hasBeenVisible = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            hasBeenVisible = true;
          } else if (
            hasBeenVisible &&
            !showExitDialog &&
            round >= 3 &&
            round < HUMOR_ROUNDS.length - 1
          ) {
            const nextRound = HUMOR_ROUNDS[Math.min(round + 1, HUMOR_ROUNDS.length - 1)];
            if (nextRound?.exitTitle) {
              setShowExitDialog(true);
              track("exit_dialog_shown", { round });
            }
          }
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [round, showExitDialog, track, widgetRef]);

  const handleStay = useCallback(() => {
    setShowExitDialog(false);
    track("exit_dialog_stay", { round });
    // Scroll widget back into view
    widgetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [round, track, widgetRef]);

  const handleDismiss = useCallback(() => {
    setShowExitDialog(false);
    track("exit_dialog_dismiss", { round });
    const nextRound = Math.min(round + 1, HUMOR_ROUNDS.length - 1);
    advanceRound(nextRound);

    const nextConfig = HUMOR_ROUNDS[nextRound];
    if (nextConfig?.animation === "confetti") {
      triggerConfetti();
    }

    // Final round: unlock survivor badge
    if (nextRound === HUMOR_ROUNDS.length - 1 && !survivor) {
      setSurvivor(true);
      setWidgetSurvivor(slug);
      track("widget_survivor_unlocked", { totalDismissals: round + 1 });
    }
  }, [round, advanceRound, slug, survivor, track, triggerConfetti]);

  const handleBump = useCallback(async () => {
    if (bumped) return;
    track("fistbump_click");
    setBumpAnimating(true);
    setTimeout(() => setBumpAnimating(false), 600);
    try {
      const res = await fetch(apiUrl("/support/fistbump"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, clientId: getClientId() }),
      });
      const data = (await res.json()) as { count: number };
      setBumpCount(data.count);
      setBumped(true);
      try {
        localStorage.setItem(`spike_bumped_${slug}`, "1");
      } catch {
        /* best-effort */
      }
    } catch {
      /* best-effort */
    }
  }, [bumped, slug, track]);

  const handleDonate = useCallback(async () => {
    if (!canDonate || selectedAmount === null) return;

    const amount: number = selectedAmount;
    track("donate_click", { amount });
    setDonating(true);
    try {
      const res = await fetch(apiUrl("/support/donate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, amount, clientId: getClientId() }),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        track("checkout_started", { amount });
        window.location.href = data.url;
      }
    } catch {
      setDonating(false);
    }
  }, [canDonate, selectedAmount, slug, track]);

  const handleSliderChange = useCallback(
    (idx: number) => {
      setSliderIdx(idx);
      track("slider_change", { idx });

      if (!sliderTouched && round < 1) {
        setSliderTouched(true);
        advanceRound(1);
      }

      if (idx === 0 && round < 3) {
        advanceRound(3);
      }
    },
    [sliderTouched, round, advanceRound, track],
  );

  const handleCustomToggle = useCallback(() => {
    const next = !showCustom;
    setShowCustom(next);
    track("custom_toggle", { showCustom: next });
    if (next && round < 2) {
      advanceRound(2);
    }
  }, [showCustom, round, advanceRound, track]);

  // Round 14 auto-moves slider to £1
  useEffect(() => {
    if (round === 14) {
      setSliderIdx(1);
      setShowCustom(false);
    }
  }, [round]);

  const animClass = currentRound.animation ? (ANIMATION_CLASSES[currentRound.animation] ?? "") : "";

  return (
    <>
      <div
        ref={widgetRef}
        className={cn(
          "mt-20 p-8 sm:p-12 rounded-[3rem] border border-border/60 shadow-[var(--panel-shadow)] relative overflow-hidden transition-all duration-700",
          currentRound.darkMode ? "bg-zinc-900 text-zinc-100 border-zinc-700/50" : "bg-card",
          animClass,
        )}
      >
        {showConfetti && <ConfettiEffect />}

        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <Heart size={200} fill="currentColor" />
        </div>

        {/* Survivor badge */}
        {survivor && (
          <div className="absolute top-6 right-6 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <Trophy size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.24em]">
              Widget Survivor
            </span>
          </div>
        )}

        <div className="max-w-2xl relative z-10">
          <h3
            className={cn(
              "text-3xl font-black tracking-tight mb-4",
              currentRound.darkMode && "text-zinc-100",
            )}
          >
            {currentRound.heading}
          </h3>
          <p
            className={cn(
              "text-lg font-medium leading-relaxed mb-10",
              currentRound.darkMode ? "text-zinc-400" : "text-muted-foreground/80",
            )}
          >
            {currentRound.subtext}
          </p>

          <div className="flex flex-col sm:flex-row gap-6 mb-12">
            <Button
              variant={bumped ? "outline" : "default"}
              className={cn(
                "rounded-2xl h-14 px-8 font-black uppercase tracking-[0.24em] text-xs transition-all duration-500",
                !bumped && "shadow-xl shadow-primary/20 hover:scale-105 active:scale-95",
              )}
              onClick={() => {
                void handleBump();
              }}
              disabled={bumped}
            >
              <Heart
                className={cn("mr-2 size-4", bumpAnimating && "animate-ping")}
                fill={bumped ? "currentColor" : "none"}
              />
              {bumped ? "Sent Love" : "Fist Bump"}
            </Button>
            <div className="flex flex-col justify-center">
              <p
                className={cn(
                  "text-[10px] font-black uppercase tracking-[0.24em]",
                  currentRound.darkMode ? "text-zinc-600" : "text-muted-foreground/40",
                )}
              >
                Engagement
              </p>
              <p
                className={cn(
                  "text-sm font-bold",
                  currentRound.darkMode ? "text-zinc-300" : "text-foreground",
                )}
              >
                {bumpCount} fist bumps &middot; {supporters} supporters
              </p>
            </div>
          </div>

          <div
            className={cn(
              "space-y-8 rounded-[2rem] p-8 border",
              currentRound.darkMode
                ? "bg-zinc-800/50 border-zinc-700/50"
                : "bg-muted/30 border-border/60",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <DisplayIcon className="size-6" />
                </div>
                <div>
                  <p className="text-2xl font-black leading-none">
                    {SUPPORT_CURRENCY_SYMBOL}
                    {displayAmount}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-bold uppercase tracking-[0.24em] mt-1",
                      currentRound.darkMode ? "text-zinc-500" : "text-muted-foreground",
                    )}
                  >
                    {displayLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCustomToggle}
                className="text-[10px] font-black uppercase tracking-[0.24em] text-primary hover:opacity-80 transition-opacity"
              >
                {showCustom ? "Presets" : "Custom"}
              </button>
            </div>

            {!showCustom && (
              <input
                type="range"
                min={0}
                max={stops.length - 1}
                step={1}
                value={sliderIdx}
                onPointerDown={() => track("slider_start", { idx: sliderIdx })}
                onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                onPointerUp={() =>
                  track("slider_final", { idx: sliderIdx, amount: stops[sliderIdx]?.amount })
                }
                className="w-full h-2 bg-border rounded-full appearance-none cursor-pointer accent-primary"
              />
            )}

            {showCustom && (
              <div className="relative">
                <span
                  className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 font-black",
                    currentRound.darkMode ? "text-zinc-600" : "text-muted-foreground/50",
                  )}
                >
                  {SUPPORT_CURRENCY_SYMBOL}
                </span>
                <input
                  type="number"
                  value={customAmount}
                  min={SUPPORT_AMOUNT_MIN}
                  max={SUPPORT_AMOUNT_MAX}
                  step="0.01"
                  onChange={(e) => setCustomAmount(normalizeSupportAmountInput(e.target.value))}
                  onBlur={() =>
                    setCustomAmount((currentAmount) => normalizeSupportAmountInput(currentAmount))
                  }
                  placeholder="5.00"
                  className={cn(
                    "w-full h-14 border-2 rounded-2xl px-8 font-black text-xl focus:border-primary focus:outline-none transition-all",
                    currentRound.darkMode
                      ? "bg-zinc-900 border-zinc-700 text-zinc-100"
                      : "bg-background border-border/60",
                  )}
                />
              </div>
            )}

            <p
              className={cn(
                "text-xs font-medium italic leading-relaxed",
                currentRound.darkMode ? "text-zinc-500" : "text-muted-foreground",
              )}
            >
              &ldquo;{displaySub}&rdquo;
            </p>

            <Button
              className="w-full rounded-2xl h-14 font-black uppercase tracking-[0.24em] text-xs shadow-xl shadow-primary/20"
              onClick={() => {
                void handleDonate();
              }}
              loading={donating}
              disabled={!canDonate}
            >
              {donating ? "Redirecting..." : "Support Development"}
            </Button>
          </div>

          {/* Round indicator */}
          {round > 0 && (
            <div className="mt-6 flex items-center gap-2">
              <Sparkles size={12} className="text-primary/40" />
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-[0.24em]",
                  currentRound.darkMode ? "text-zinc-600" : "text-muted-foreground/30",
                )}
              >
                Widget persistence level {round + 1}/16
              </p>
            </div>
          )}

          <div className="mt-12 flex flex-wrap items-center gap-6">
            <p
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.24em]",
                currentRound.darkMode ? "text-zinc-600" : "text-muted-foreground/40",
              )}
            >
              Spread the Word
            </p>
            <a
              href={xIntent}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("share_click", { platform: "x" })}
              className={cn(
                "text-xs font-bold transition-colors flex items-center gap-1.5",
                currentRound.darkMode
                  ? "text-zinc-500 hover:text-primary"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              <Twitter size={14} /> X / Twitter
            </a>
            <a
              href={linkedInIntent}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("share_click", { platform: "linkedin" })}
              className={cn(
                "text-xs font-bold transition-colors flex items-center gap-1.5",
                currentRound.darkMode
                  ? "text-zinc-500 hover:text-primary"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              <Linkedin size={14} /> LinkedIn
            </a>
          </div>
        </div>
      </div>

      {/* Exit Dialog */}
      <AnimatePresence>
        {showExitDialog && currentRound.exitTitle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center bg-background/80 backdrop-blur-xl p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md p-8 rounded-[2rem] bg-card border border-border/60 shadow-[var(--panel-shadow)] relative overflow-hidden"
            >
              {currentRound.animation === "confetti" && <ConfettiEffect />}

              <h3 className="text-2xl font-black tracking-tight mb-4">{currentRound.exitTitle}</h3>
              <p className="text-muted-foreground font-medium leading-relaxed mb-8">
                {currentRound.exitBody}
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleStay}
                  className="rounded-2xl h-12 font-black uppercase tracking-[0.24em] text-xs w-full"
                >
                  {currentRound.exitStay}
                </Button>
                <button
                  onClick={handleDismiss}
                  className="text-xs font-bold text-muted-foreground/60 hover:text-muted-foreground transition-colors py-2"
                >
                  {currentRound.exitDismiss}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { BlogPost } from "../core-logic/types";
import { apiUrl } from "../core-logic/api";
import { BlogListView } from "./BlogList";
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
} from "lucide-react";
import { Button, buttonVariants } from "../lazy-imports/button";
import { cn } from "@spike-land-ai/shared";

/**
 * Convert self-closing JSX/HTML tags for custom components to explicit
 * open/close pairs.
 */
function fixSelfClosingTags(markdown: string): string {
  return markdown.replace(
    /<([A-Z][a-zA-Z]*)((?:\s+[a-zA-Z-]+=(?:"[^"]*"|'[^']*'|{[^}]*}))*)\s*\/>/g,
    (_, tag, attrs) => `<${tag}${attrs}></${tag}>`,
  );
}

const DemoFallback = () => (
  <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-3xl border border-border/50">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
      Initializing Demo...
    </p>
  </div>
);

function lazyDemo(load: () => Promise<Record<string, unknown>>, name: string) {
  const LazyComp = lazy(() =>
    load().then((mod) => ({ default: mod[name] as React.ComponentType<Record<string, unknown>> })),
  );
  return function LazyDemoWrapper(props: Record<string, unknown>) {
    return (
      <Suspense fallback={<DemoFallback />}>
        <div className="not-prose my-12 overflow-hidden rounded-3xl border border-border/50 bg-card shadow-2xl">
          <LazyComp {...props} />
        </div>
      </Suspense>
    );
  };
}

const interactiveImport = () =>
  import("../core-logic/interactive-index") as Promise<Record<string, unknown>>;

const COMPONENT_MAP: Record<string, React.ComponentType<Record<string, unknown>>> = {
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
  scrollstorycard: lazyDemo(interactiveImport, "ScrollStoryCard"),
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
  spikechatembed: lazyDemo(interactiveImport, "SpikeChatEmbed"),
  tldr: ({ children, title }: { children?: React.ReactNode; title?: string }) => (
    <div className="bg-primary/[0.03] border-2 border-primary/10 rounded-[2rem] p-8 my-12 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
        <Zap size={80} className="text-primary" />
      </div>
      <h3 className="text-lg font-black uppercase tracking-widest mb-4 text-primary flex items-center gap-2">
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
  p: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className="text-lg text-muted-foreground leading-relaxed font-medium my-6" {...props}>
      {children}
    </div>
  ),
  img: ({ src, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <div className="my-12">
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className="rounded-3xl shadow-2xl border border-border/50 mx-auto transition-transform hover:scale-[1.01] duration-500"
        {...rest}
      />
      {alt && (
        <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground/40">
          {alt}
        </p>
      )}
    </div>
  ),
};

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
  const [post, setPost] = useState<BlogPost | null>(postOverride);
  const [loading, setLoading] = useState(!postOverride && !skipFetch);
  const [error, setError] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isHeroExpanded, setIsHeroExpanded] = useState(false);

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
    if (postOverride) {
      setPost(postOverride);
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
      .then(setPost)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [postOverride, skipFetch, slug]);

  const resolvedPost = postOverride ?? post;

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
        <div className="inline-flex size-20 items-center justify-center rounded-3xl bg-destructive/5 text-destructive mb-8">
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

        {resolvedPost.heroImage && (
          <>
            <motion.div
              layoutId={`hero-image-${slug}`}
              className="mb-16 rounded-[3rem] overflow-hidden shadow-2xl ring-1 ring-border/5 cursor-zoom-in group"
              onClick={() => setIsHeroExpanded(true)}
            >
              <motion.img
                src={resolvedPost.heroImage}
                alt={resolvedPost.title}
                width={1200}
                height={514}
                loading="eager"
                decoding="async"
                className="w-full aspect-[21/9] object-cover hidden dark:block"
              />
              <motion.img
                src={resolvedPost.heroImage.replace(/\.(png|jpe?g|webp|avif)$/i, "-light.$1")}
                alt={resolvedPost.title}
                width={1200}
                height={514}
                loading="eager"
                decoding="async"
                className="w-full aspect-[21/9] object-cover dark:hidden block"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = resolvedPost.heroImage!;
                }}
              />
            </motion.div>
            <AnimatePresence>
              {isHeroExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-xl cursor-zoom-out p-4 sm:p-8"
                  onClick={() => setIsHeroExpanded(false)}
                >
                  <motion.img
                    layoutId={`hero-image-${slug}`}
                    src={resolvedPost.heroImage}
                    alt={resolvedPost.title}
                    className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain hidden dark:block"
                  />
                  <motion.img
                    layoutId={`hero-image-${slug}-light`}
                    src={resolvedPost.heroImage.replace(/\.(png|jpe?g|webp|avif)$/i, "-light.$1")}
                    alt={resolvedPost.title}
                    className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain dark:hidden block"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = resolvedPost.heroImage!;
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

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

          <h1 className="text-5xl sm:text-7xl font-black text-foreground tracking-tighter leading-[0.85] text-balance">
            {resolvedPost.title}
          </h1>

          {resolvedPost.primer && (
            <p className="text-xl sm:text-2xl text-muted-foreground/80 font-medium leading-relaxed italic border-l-4 border-primary/20 pl-6">
              "{resolvedPost.primer}"
            </p>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-border/50">
            <div className="size-10 rounded-2xl bg-primary flex items-center justify-center text-xs font-black text-primary-foreground shadow-lg shadow-primary/20">
              {resolvedPost.author?.[0] || "S"}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-foreground">
                {resolvedPost.author || "Spike land Team"}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                Independent Developer & Researcher
              </p>
            </div>
          </div>
        </header>

        <div
          className="prose dark:prose-invert max-w-3xl mx-auto
          prose-headings:font-black prose-headings:text-foreground prose-headings:tracking-tighter
          prose-h1:text-4xl prose-h2:text-3xl prose-h2:mt-16 prose-h2:mb-8
          prose-h3:text-2xl prose-h3:mt-12 prose-h3:mb-6
          prose-p:text-lg prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:font-medium
          prose-a:text-primary prose-a:font-bold prose-a:no-underline hover:prose-a:underline
          prose-strong:text-foreground prose-strong:font-black
          prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:bg-primary/[0.02] prose-blockquote:py-6 prose-blockquote:px-8 prose-blockquote:rounded-r-3xl prose-blockquote:text-foreground prose-blockquote:font-bold prose-blockquote:italic
          prose-code:text-primary prose-code:bg-primary/[0.05] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-lg prose-code:before:content-none prose-code:after:content-none prose-code:font-bold
          prose-pre:bg-muted/50 prose-pre:border-2 prose-pre:border-border/50 prose-pre:rounded-[2rem] prose-pre:px-4 prose-pre:py-4 sm:prose-pre:px-6 sm:prose-pre:py-5 prose-pre:overflow-x-auto
          prose-li:text-muted-foreground prose-li:font-medium
          prose-ul:list-disc prose-ol:list-decimal
          prose-img:rounded-[2.5rem] prose-img:shadow-2xl prose-img:border prose-img:border-border/50
          selection:bg-primary selection:text-primary-foreground"
        >
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={
              COMPONENT_MAP as Record<string, React.ComponentType<Record<string, unknown>>>
            }
          >
            {fixSelfClosingTags(cleanContent)}
          </Markdown>
        </div>

        <div className="max-w-3xl mx-auto">
          <SupportWidget post={resolvedPost} />
        </div>

        <div className="mt-32 pt-16 border-t border-border/50">
          <h2 className="text-3xl font-black tracking-tight text-center mb-16">Continue Reading</h2>
          <BlogListView linkComponent={linkComponent} limit={3} showHeader={false} />
        </div>
      </article>
    </ExperimentProvider>
  );
}

// ─── Support Widget ─────────────────────────────────────────────────────────

const SLIDER_STOPS = [
  { amount: 0, label: "Moral support", sub: "Keep building awesome stuff!", icon: Heart },
  { amount: 1, label: "A tiny coffee", sub: "Fuel for the next MCP tool.", icon: Coffee },
  { amount: 5, label: "The proper brew", sub: "A high-end Brighton flat white.", icon: Coffee },
  { amount: 10, label: "Server runtime", sub: "Covers our edge hosting for a week.", icon: Zap },
  { amount: 25, label: "Growth Fund", sub: "Help us build more complex agents.", icon: Shield },
  { amount: 100, label: "Legend Tier", sub: "We will name a variable after you.", icon: Gift },
] as const;

function getArticleCopy(_category: string, _tags: string[]): string {
  return "Independent development is a labor of love. No VC funding, no bloated team—just code, mass-produced coffee, and a vision for an agentic future. If you find value in these tools, consider supporting the journey.";
}

function getClientId(): string {
  const key = "spike_client_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function SupportWidget({ post }: { post: BlogPost }) {
  const slug = post.slug;
  const url = `https://spike.land/blog/${slug}`;
  const xIntent = `https://x.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(url)}`;
  const linkedInIntent = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const { assignments, config } = useExperiment();
  const { widgetRef, track } = useWidgetTracking(slug, assignments);

  const [sliderIdx, setSliderIdx] = useState(config.defaultSliderIdx);
  const [customAmount, setCustomAmount] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [bumped, setBumped] = useState(false);
  const [bumpCount, setBumpCount] = useState(0);
  const [supporters, setSupporters] = useState(0);
  const [bumpAnimating, setBumpAnimating] = useState(false);
  const [donating, setDonating] = useState(false);

  const currentStop = SLIDER_STOPS[sliderIdx] || SLIDER_STOPS[0];
  const Icon = currentStop.icon;

  useEffect(() => {
    if (!localStorage.getItem(`spike_bumped_${slug}`)) return;
    setBumped(true);
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
      localStorage.setItem(`spike_bumped_${slug}`, "1");
    } catch {
      /* best-effort — fistbump is non-critical */
    }
  }, [bumped, slug, track]);

  const handleDonate = useCallback(async () => {
    const amount = showCustom ? parseFloat(customAmount) : currentStop.amount;
    if (!amount || amount < 1) return;
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
  }, [currentStop.amount, showCustom, customAmount, slug, track]);

  return (
    <div
      ref={widgetRef}
      className="mt-20 p-8 sm:p-12 rounded-[3rem] bg-card border border-border/50 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <Heart size={200} fill="currentColor" />
      </div>

      <div className="max-w-2xl relative z-10">
        <h3 className="text-3xl font-black tracking-tight mb-4">Support the Journey</h3>
        <p className="text-lg text-muted-foreground/80 font-medium leading-relaxed mb-10">
          {getArticleCopy(post.category, post.tags)}
        </p>

        <div className="flex flex-col sm:flex-row gap-6 mb-12">
          <Button
            variant={bumped ? "outline" : "default"}
            className={cn(
              "rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-xs transition-all duration-500",
              !bumped && "shadow-xl shadow-primary/20 hover:scale-105 active:scale-95",
            )}
            onClick={handleBump}
            disabled={bumped}
          >
            <Heart
              className={cn("mr-2 size-4", bumpAnimating && "animate-ping")}
              fill={bumped ? "currentColor" : "none"}
            />
            {bumped ? "Sent Love" : "Fist Bump"}
          </Button>
          <div className="flex flex-col justify-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              Engagement
            </p>
            <p className="text-sm font-bold text-foreground">
              {bumpCount} fist bumps &middot; {supporters} supporters
            </p>
          </div>
        </div>

        <div className="space-y-8 bg-muted/30 rounded-[2rem] p-8 border border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Icon className="size-6" />
              </div>
              <div>
                <p className="text-2xl font-black leading-none">
                  ${showCustom ? customAmount || "0" : currentStop.amount}
                </p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  {currentStop.label}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const next = !showCustom;
                setShowCustom(next);
                track("custom_toggle", { showCustom: next });
              }}
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:opacity-80 transition-opacity"
            >
              {showCustom ? "Presets" : "Custom"}
            </button>
          </div>

          {!showCustom && (
            <input
              type="range"
              min={0}
              max={SLIDER_STOPS.length - 1}
              step={1}
              value={sliderIdx}
              onPointerDown={() => track("slider_start", { idx: sliderIdx })}
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                setSliderIdx(idx);
                track("slider_change", { idx });
              }}
              onPointerUp={() =>
                track("slider_final", { idx: sliderIdx, amount: SLIDER_STOPS[sliderIdx]?.amount })
              }
              className="w-full h-2 bg-border rounded-full appearance-none cursor-pointer accent-primary"
            />
          )}

          {showCustom && (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 font-black">
                $
              </span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0.00"
                className="w-full h-14 bg-background border-2 border-border/50 rounded-2xl px-8 font-black text-xl focus:border-primary focus:outline-none transition-all"
              />
            </div>
          )}

          <p className="text-xs font-medium text-muted-foreground italic leading-relaxed">
            "{currentStop.sub}"
          </p>

          <Button
            className="w-full rounded-2xl h-14 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
            onClick={handleDonate}
            loading={donating}
            disabled={!showCustom && currentStop.amount === 0}
          >
            {donating ? "Redirecting..." : "Support Development"}
          </Button>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
            Spread the Word
          </p>
          <a
            href={xIntent}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("share_click", { platform: "x" })}
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Twitter size={14} /> X / Twitter
          </a>
          <a
            href={linkedInIntent}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("share_click", { platform: "linkedin" })}
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Linkedin size={14} /> LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}

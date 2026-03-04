import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import type { BlogPost } from "../../core/types";
import { BlogListView } from "./BlogList";

/**
 * Convert self-closing JSX/HTML tags for custom components to explicit
 * open/close pairs. HTML5 only treats void elements (img, br, hr, etc.)
 * as self-closing — `<Foo />` is parsed as `<Foo>` by rehype-raw,
 * which swallows all subsequent content as children.
 */
function fixSelfClosingTags(markdown: string): string {
  return markdown.replace(/<([A-Z][a-zA-Z]*)((?:\s+[a-zA-Z-]+=(?:"[^"]*"|'[^']*'|{[^}]*}))*)\s*\/>/g,
    (_, tag, attrs) => `<${tag}${attrs}></${tag}>`);
}

const DemoFallback = () => (
  <div className="flex items-center justify-center py-8">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
  </div>
);

function lazyDemo(
  load: () => Promise<Record<string, unknown>>,
  name: string
) {
  const LazyComp = lazy(() =>
    load().then((mod) => ({ default: mod[name] as React.ComponentType<Record<string, unknown>> }))
  );
  return function LazyDemoWrapper(props: Record<string, unknown>) {
    return (
      <Suspense fallback={<DemoFallback />}>
        <LazyComp {...props} />
      </Suspense>
    );
  };
}

const interactiveImport = () => import("../interactive") as Promise<Record<string, unknown>>;

const COMPONENT_MAP: Record<string, React.ComponentType<Record<string, unknown>>> = {
  convergencedemo: lazyDemo(interactiveImport, "ConvergenceDemo"),
  dependencycascadedemo: lazyDemo(interactiveImport, "DependencyCascadeDemo"),
  stackcollapsedemo: lazyDemo(interactiveImport, "StackCollapseDemo"),
  agentcoordinationdemo: lazyDemo(interactiveImport, "AgentCoordinationDemo"),
  splitscreendemo: lazyDemo(interactiveImport, "SplitScreenDemo"),
  attentionspotlightdemo: lazyDemo(interactiveImport, "AttentionSpotlightDemo"),
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
  tldr: ({ children, title }: { children?: React.ReactNode; title?: string }) => (
    <div className="bg-muted/50 border border-border rounded-xl p-6 mb-8">
      <h3 className="text-lg font-semibold mb-3 text-foreground">{title ?? "TL;DR"}</h3>
      <div className="text-muted-foreground space-y-2 [&>ul]:space-y-2 [&>ul]:list-none [&>ul]:pl-0 [&>p]:leading-relaxed">
        {children}
      </div>
    </div>
  ),
  callout: ({ children, type }: { children?: React.ReactNode; type?: string }) => (
    <div className={`p-4 my-6 rounded-xl border ${type === 'info' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 text-blue-900 dark:text-blue-100' :
        type === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800 text-green-900 dark:text-green-100' :
          type === 'warning' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 text-amber-900 dark:text-amber-100' :
            'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
      }`}>
      {children}
    </div>
  ),
  img: ({ src, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      width={1200}
      height={630}
      className="rounded-2xl shadow-2xl border border-border"
      {...rest}
    />
  ),
};

export function BlogPostView({ slug, linkComponent }: { slug: string; linkComponent?: React.ComponentType<{ to: string; className?: string; children?: React.ReactNode }> }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/blog/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json() as Promise<BlogPost>;
      })
      .then(setPost)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8 animate-pulse">
        <div className="text-center mb-12">
          <div className="h-4 bg-muted rounded w-1/4 mx-auto mb-6" />
          <div className="h-12 bg-muted rounded w-3/4 mx-auto mb-6" />
          <div className="h-6 bg-muted rounded w-1/2 mx-auto" />
        </div>
        <div className="space-y-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-5 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !post) {
    const BackLink = linkComponent;
    return (
      <div className="max-w-3xl mx-auto py-20 px-4 text-center">
        <h1 className="text-4xl font-display font-bold text-foreground">Post not found</h1>
        <p className="mt-6 text-xl text-muted-foreground">The post you are looking for does not exist.</p>
        {BackLink ? (
          <BackLink to="/blog" className="mt-8 inline-block text-primary hover:opacity-80 transition-colors font-semibold">
            ← Back to Blog
          </BackLink>
        ) : (
          <a href="/blog" className="mt-8 inline-block text-primary hover:opacity-80 transition-colors font-semibold">
            ← Back to Blog
          </a>
        )}
      </div>
    );
  }

  const BackLink = linkComponent;
  const cleanContent = post.content.replace(/!\[[^\]]*\]\(https:\/\/placehold\.co\/[^)]+\)\n?/g, "");

  return (
    <article className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="mb-6">
        {BackLink ? (
          <BackLink to="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            &larr; Blog
          </BackLink>
        ) : (
          <a href="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            &larr; Blog
          </a>
        )}
      </div>

      {post.heroImage && (
        <img
          src={post.heroImage}
          alt={post.title}
          loading="eager"
          decoding="async"
          className="w-full rounded-2xl shadow-2xl border border-border mb-8"
        />
      )}

      <header className="mb-8 text-center border-b border-border pb-6">
        <div className="flex justify-center items-center gap-3 text-sm text-muted-foreground mb-6 font-medium tracking-wide uppercase">
          <time dateTime={post.date}>{new Date(post.date).toLocaleDateString()}</time>
          {post.category && (
            <>
              <span className="text-muted-foreground/40">&bull;</span>
              <span className="text-primary">{post.category}</span>
            </>
          )}
        </div>
        <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-foreground tracking-tight leading-tight mb-6 drop-shadow-sm">
          {post.title}
        </h1>
        {post.primer && (
          <p className="text-base text-muted-foreground italic mb-4">
            {post.primer}
          </p>
        )}
        {post.description && (
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-light">
            {post.description}
          </p>
        )}
      </header>

      <div className="prose dark:prose-invert max-w-none
        prose-headings:font-display prose-headings:font-bold prose-headings:text-foreground prose-headings:tracking-tight
        prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl
        prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:font-sans
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline hover:prose-a:opacity-80
        prose-strong:text-foreground prose-strong:font-semibold
        prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:text-foreground prose-blockquote:font-medium prose-blockquote:italic
        prose-code:text-primary prose-code:bg-muted/50 prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-muted prose-pre:border prose-pre:border-border
        prose-img:rounded-2xl prose-img:shadow-2xl prose-img:border prose-img:border-border
        prose-table:w-full prose-table:border-collapse
        prose-thead:bg-muted/50
        prose-th:border prose-th:border-border prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:text-foreground prose-th:font-semibold
        prose-td:border prose-td:border-border prose-td:px-4 prose-td:py-2 prose-td:text-muted-foreground
        prose-ul:text-muted-foreground prose-ol:text-muted-foreground
        prose-li:marker:text-primary">
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={COMPONENT_MAP as unknown as Record<string, React.ComponentType>}>
          {fixSelfClosingTags(cleanContent)}
        </Markdown>
      </div>

      <SupportWidget post={post} />

      <div className="mt-16 pt-8 border-t border-border">
        <h2 className="text-2xl font-display font-bold text-foreground mb-8 text-center">
          More from the blog
        </h2>
        <BlogListView linkComponent={linkComponent} limit={3} showHeader={false} />
      </div>
    </article>
  );
}

// ─── Support Widget ─────────────────────────────────────────────────────────

const SLIDER_STOPS = [
  { amount: 0, label: "Moral support (we accept tears)", sub: "Free. Like our time, apparently." },
  { amount: 1, label: "One mass-produced coffee", sub: "The kind that tastes like ambition and regret" },
  { amount: 3, label: "A proper flat white", sub: "Brighton prices, obviously" },
  { amount: 5, label: "Gian Pierre gets a treat", sub: "He has earned it. Unlike us." },
  { amount: 10, label: "A week of domain renewals", sub: "spike.land does not host itself" },
  { amount: 25, label: "One month of Cloudflare Workers", sub: "D1 queries are not free. Except the first billion." },
  { amount: 50, label: "The 'holy shit someone actually paid' tier", sub: "We will screenshot this and frame it" },
  { amount: 100, label: "Redundancy survival fund", sub: "One month closer to not having to explain the gap" },
] as const;

function getArticleCopy(category: string, tags: string[]): string {
  const lc = category.toLowerCase();
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));

  if (lc.includes("developer experience") || tagSet.has("developer-tools") || tagSet.has("dx")) {
    return "This post was debugged with mass-produced coffee and questionable life choices.";
  }
  if (lc.includes("ai") || tagSet.has("agents") || tagSet.has("claude") || tagSet.has("llm")) {
    return "Training AI costs money. Training the humans who wrangle AI costs dignity. Both are running low.";
  }
  if (lc.includes("architecture") || lc.includes("infrastructure") || tagSet.has("cloudflare")) {
    return "Every Worker invocation is a prayer to the edge. Some prayers need funding.";
  }
  if (lc.includes("testing") || lc.includes("quality") || tagSet.has("vitest") || tagSet.has("qa")) {
    return "We test in production because we cannot afford staging. Help us afford staging.";
  }
  return "Written by an independent developer in Brighton, UK. Recently made redundant. No VC, no team — just a laptop, a mass of MCP servers, and an ungodly amount of mass-produced coffee.";
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

  const [sliderIdx, setSliderIdx] = useState(3); // Default: $5
  const [customAmount, setCustomAmount] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [bumped, setBumped] = useState(false);
  const [bumpCount, setBumpCount] = useState(0);
  const [supporters, setSupporters] = useState(0);
  const [bumpAnimating, setBumpAnimating] = useState(false);
  const [donating, setDonating] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const bumpRef = useRef<HTMLButtonElement>(null);

  // Check thank-you state from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("supported") === "1") {
      setThankYou(true);
      // Clean the URL
      const cleaned = window.location.pathname;
      window.history.replaceState({}, "", cleaned);
    }
  }, []);

  // Check if already bumped
  useEffect(() => {
    const bumpKey = `spike_bumped_${slug}`;
    if (localStorage.getItem(bumpKey)) {
      setBumped(true);
    }
  }, [slug]);

  // Fetch engagement stats
  useEffect(() => {
    fetch(`/api/support/engagement/${encodeURIComponent(slug)}`)
      .then((r) => r.ok ? r.json() as Promise<{ fistBumps: number; supporters: number }> : null)
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
    setBumpAnimating(true);
    setTimeout(() => setBumpAnimating(false), 600);

    try {
      const res = await fetch("/api/support/fistbump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, clientId: getClientId() }),
      });
      const data = await res.json() as { count: number };
      setBumpCount(data.count);
      setBumped(true);
      localStorage.setItem(`spike_bumped_${slug}`, "1");
    } catch {
      // Silent fail
    }
  }, [bumped, slug]);

  const handleDonate = useCallback(async () => {
    const stop = SLIDER_STOPS[sliderIdx];
    const amount = showCustom
      ? parseFloat(customAmount)
      : stop?.amount ?? 5;

    if (!amount || amount < 1) return;
    setDonating(true);

    try {
      const res = await fetch("/api/support/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, amount }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setDonating(false);
    }
  }, [sliderIdx, showCustom, customAmount, slug]);

  const currentStop = SLIDER_STOPS[sliderIdx];
  const copy = getArticleCopy(post.category, post.tags);

  return (
    <div className="border-t border-border mt-12 pt-8">
      {/* Thank-you confetti state */}
      {thankYou && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 mb-6 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-green-900 dark:text-green-100 font-semibold">You absolute legend.</p>
          <p className="text-green-700 dark:text-green-300 text-sm mt-1">
            Your support means more than you know. Seriously. We might frame this.
          </p>
        </div>
      )}

      {/* Article-adapted copy */}
      <p className="text-sm text-muted-foreground leading-relaxed mb-6">
        {copy}
      </p>

      {/* Engagement counters */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground/70 mb-6">
        <span>👊 {bumpCount} fist bump{bumpCount !== 1 ? "s" : ""}</span>
        {supporters > 0 && (
          <span>💛 {supporters} supporter{supporters !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Fist Bump button */}
      <div className="mb-6">
        <button
          ref={bumpRef}
          onClick={handleBump}
          disabled={bumped}
          className={`
            inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium
            transition-all duration-200
            ${bumped
              ? "bg-muted text-muted-foreground cursor-default"
              : "bg-foreground text-background hover:opacity-90 active:scale-95 cursor-pointer"
            }
            ${bumpAnimating ? "scale-110" : ""}
          `}
          style={{
            transition: bumpAnimating
              ? "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
              : "transform 0.2s ease, opacity 0.2s ease",
          }}
        >
          <span className={`text-lg ${bumpAnimating ? "animate-bounce" : ""}`}>
            {bumped ? "✊" : "👊"}
          </span>
          {bumped ? "Bumped!" : "Fist bump (free)"}
        </button>
      </div>

      {/* Slider */}
      <div className="bg-muted/30 border border-border rounded-xl p-5 mb-6">
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
          Sponsor Zoltan & Gian Pierre
        </p>

        <input
          type="range"
          min={0}
          max={SLIDER_STOPS.length - 1}
          step={1}
          value={sliderIdx}
          onChange={(e) => {
            const idx = parseInt(e.target.value, 10);
            setSliderIdx(idx);
            setShowCustom(false);
          }}
          className="w-full h-2 bg-border rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:border-background"
        />

        {/* Slider label */}
        {currentStop && (
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {currentStop.amount === 0 ? "$0" : `$${currentStop.amount}`}
              </span>
              <span className="text-sm font-medium text-foreground">
                {currentStop.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 italic">
              {currentStop.sub}
            </p>
          </div>
        )}

        {/* Custom amount toggle */}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs text-primary hover:opacity-80 mt-3 transition-colors"
        >
          {showCustom ? "← Back to presets" : "Name your price, champion →"}
        </button>

        {showCustom && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              type="number"
              min={1}
              max={999}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Your amount"
              className="w-24 px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground"
            />
          </div>
        )}

        {/* Donate button — only for amounts > $0 */}
        {(showCustom || (currentStop && currentStop.amount > 0)) && (
          <button
            onClick={handleDonate}
            disabled={donating || (showCustom && (!customAmount || parseFloat(customAmount) < 1))}
            className="mt-4 w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm
              hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {donating
              ? "Redirecting to Stripe..."
              : showCustom
                ? `Donate $${customAmount || "..."}`
                : `Donate $${currentStop?.amount ?? 5}`
            }
          </button>
        )}
      </div>

      {/* Share links */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <a
          href={xIntent}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Share on X
        </a>
        <a
          href={linkedInIntent}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Share on LinkedIn
        </a>
      </div>
    </div>
  );
}

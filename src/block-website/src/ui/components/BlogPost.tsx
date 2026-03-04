import { useState, useEffect, lazy, Suspense } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import type { BlogPost } from "../../core/generated-posts";

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
  callout: ({ children, type }: { children?: React.ReactNode; type?: string }) => (
    <div className={`p-4 my-6 rounded-xl border ${
      type === 'info' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 text-blue-900 dark:text-blue-100' :
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
      <div className="max-w-5xl mx-auto py-16 px-4 sm:px-6 lg:px-8 animate-pulse">
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
      <div className="max-w-5xl mx-auto py-20 px-4 text-center">
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

  return (
    <article className="max-w-5xl mx-auto py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <header className="mb-16 text-center border-b border-border pb-12">
        <div className="flex justify-center items-center gap-3 text-sm text-muted-foreground mb-6 font-medium tracking-wide uppercase">
          <time dateTime={post.date}>{new Date(post.date).toLocaleDateString()}</time>
          {post.category && (
            <>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-primary">{post.category}</span>
            </>
          )}
        </div>
        <h1 className="text-5xl sm:text-7xl font-display font-extrabold text-foreground tracking-tight leading-tight mb-8 drop-shadow-sm">
          {post.title}
        </h1>
        {post.description && (
          <p className="text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed font-light">
            {post.description}
          </p>
        )}
      </header>

      <div className="prose prose-xl dark:prose-invert max-w-none
        prose-headings:font-display prose-headings:font-bold prose-headings:text-foreground prose-headings:tracking-tight
        prose-h1:text-5xl prose-h2:text-4xl prose-h3:text-3xl
        prose-p:text-muted-foreground prose-p:leading-loose prose-p:font-sans
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline hover:prose-a:opacity-80
        prose-strong:text-foreground prose-strong:font-semibold
        prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:text-foreground prose-blockquote:font-medium prose-blockquote:italic
        prose-code:text-primary prose-code:bg-muted/50 prose-code:px-2 prose-code:py-1 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-muted prose-pre:border prose-pre:border-border
        prose-img:rounded-2xl prose-img:shadow-2xl prose-img:border prose-img:border-border
        prose-ul:text-muted-foreground prose-ol:text-muted-foreground
        prose-li:marker:text-primary">
        <Markdown rehypePlugins={[rehypeRaw]} components={COMPONENT_MAP as unknown as Record<string, React.ComponentType>}>
          {fixSelfClosingTags(post.content)}
        </Markdown>
      </div>
    </article>
  );
}

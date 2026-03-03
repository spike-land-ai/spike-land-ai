import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { getPostBySlug } from "../../core/reducers";
import * as Interactive from "../interactive";

const COMPONENT_MAP: Record<string, any> = {
  convergencedemo: Interactive.ConvergenceDemo,
  dependencycascadedemo: Interactive.DependencyCascadeDemo,
  stackcollapsedemo: Interactive.StackCollapseDemo,
  agentcoordinationdemo: Interactive.AgentCoordinationDemo,
  splitscreendemo: Interactive.SplitScreenDemo,
  attentionspotlightdemo: Interactive.AttentionSpotlightDemo,
  fivelayerstackdemo: Interactive.FiveLayerStackDemo,
  darwiniantreedemo: Interactive.DarwinianTreeDemo,
  recursivezoomdemo: Interactive.RecursiveZoomDemo,
  modelcascadedemo: Interactive.ModelCascadeDemo,
  bayesianconfidencedemo: Interactive.BayesianConfidenceDemo,
  mcpterminaldemo: Interactive.MCPTerminalDemo,
  scrollstorycard: Interactive.ScrollStoryCard,
  mcpflowdiagram: Interactive.MCPFlowDiagram,
  perspectivecarousel: Interactive.PerspectiveCarousel,
  spikeclidemo: Interactive.SpikeCliDemo,
  pyramidreshapedemo: Interactive.PyramidReshapeDemo,
  testcodenamevenn: Interactive.TestCodeNameVenn,
  hourglassmodeldemo: Interactive.HourglassModelDemo,
  paradigmguilttimeline: Interactive.ParadigmGuiltTimeline,
  effortinversiondemo: Interactive.EffortInversionDemo,
  contextlayerbuilderdemo: Interactive.ContextLayerBuilderDemo,
  callout: ({ children, type }: any) => (
    <div className={`p-4 my-6 rounded-xl border ${
      type === 'info' ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 text-blue-900 dark:text-blue-100' : 
      'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
    }`}>
      {children}
    </div>
  ),
};

export function BlogPostView({ slug }: { slug: string }) {
  const post = getPostBySlug(slug);

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Post not found</h1>
        <p className="mt-4 text-gray-600 dark:text-gray-400">The post you are looking for does not exist.</p>
        <a href="/blog" className="mt-6 inline-block text-blue-600 hover:text-blue-500">
          ← Back to Blog
        </a>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <div className="flex justify-center items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <time dateTime={post.date}>{new Date(post.date).toLocaleDateString()}</time>
          {post.category && (
            <>
              <span>•</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">{post.category}</span>
            </>
          )}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
          {post.title}
        </h1>
        {post.description && (
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {post.description}
          </p>
        )}
      </header>
      
      <div className="prose prose-lg dark:prose-invert max-w-none prose-img:rounded-xl prose-img:shadow-lg">
        <Markdown rehypePlugins={[rehypeRaw]} components={COMPONENT_MAP}>
          {post.content}
        </Markdown>
      </div>
    </article>
  );
}

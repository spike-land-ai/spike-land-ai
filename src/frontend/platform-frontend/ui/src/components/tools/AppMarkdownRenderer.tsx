import { lazy, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";

const ToolSurface = lazy(() =>
  import("../../../components/tool-surface/ToolSurface").then((m) => ({
    default: m.ToolSurface,
  })),
);

interface AppMarkdownRendererProps {
  content: string;
  appSlug: string;
  graph: Record<string, unknown>;
  session: { outputs: Record<string, unknown> };
  recordToolResult: (tool: string, input: Record<string, unknown>, result: unknown) => void;
  isToolAvailable: (tool: string) => boolean;
}

export function AppMarkdownRenderer({
  content,
  appSlug,
  graph,
  session,
  recordToolResult,
  isToolAvailable,
}: AppMarkdownRendererProps) {
  return (
    <div className="prose max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          toolsurface: ({ node: _node, ...props }: Record<string, unknown>) => {
            const toolName = typeof props.name === "string" ? props.name : "";
            if (!toolName) return null;
            return (
              <div className="not-prose my-6">
                <Suspense
                  fallback={
                    <div className="p-4 flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading tool surface...</span>
                    </div>
                  }
                >
                  <ToolSurface
                    toolName={toolName}
                    appSlug={appSlug}
                    graph={graph}
                    session={session}
                    recordToolResult={recordToolResult}
                    isAvailable={isToolAvailable(toolName)}
                    defaultExpanded
                  />
                </Suspense>
              </div>
            );
          },
          toolrun: ({ node: _node, ...props }: Record<string, unknown>) => {
            const toolName = typeof props.name === "string" ? props.name : "";
            if (!toolName) return null;
            return (
              <div className="not-prose my-6">
                <Suspense
                  fallback={
                    <div className="p-4 flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading tool surface...</span>
                    </div>
                  }
                >
                  <ToolSurface
                    toolName={toolName}
                    appSlug={appSlug}
                    graph={graph}
                    session={session}
                    recordToolResult={recordToolResult}
                    isAvailable={isToolAvailable(toolName)}
                  />
                </Suspense>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

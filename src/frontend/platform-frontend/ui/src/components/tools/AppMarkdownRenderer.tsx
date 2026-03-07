import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { ToolRunButton } from "./ToolRunButton";

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
    <div className="prose dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          toolrun: ({ node: _node, ...props }: Record<string, unknown>) => {
            const toolName = typeof props.name === "string" ? props.name : "";
            if (!toolName) return null;
            return (
              <ToolRunButton
                toolName={toolName}
                appSlug={appSlug}
                graph={graph}
                session={session}
                recordToolResult={recordToolResult}
                isAvailable={isToolAvailable(toolName)}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

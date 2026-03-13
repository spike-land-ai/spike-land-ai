import {
  useState,
  useEffect,
  useMemo,
  isValidElement,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { FileText, Loader2 } from "lucide-react";
import { MdxCommandCard } from "./MdxCommandCard";
import { isExecutableShellLanguage, resolveMcpCommandBlock } from "./mcp-command-line";
import { ContextBlock } from "./context/ContextBlock";

const ToolSurface = lazy(() =>
  import("./tool-surface/ToolSurface").then((m) => ({ default: m.ToolSurface })),
);

interface MdxSurfaceProps {
  appSlug: string;
  content?: string;
  className?: string;
}

/**
 * MDX Surface: renders markdown/MDX content as an interactive app.
 * Supports embedding live MCP tool results via <toolresult> custom elements.
 */
export function MdxSurface({ appSlug, content: initialContent, className = "" }: MdxSurfaceProps) {
  const [content, setContent] = useState(initialContent || "");
  const [isLoading, setIsLoading] = useState(!initialContent);

  // Fetch MDX content from API if not provided
  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      return;
    }

    setIsLoading(true);
    fetch(`/api/store/tools/${encodeURIComponent(appSlug)}/mdx`, { credentials: "include" })
      .then((r) => {
        if (r.ok) return r.text();
        return `# ${appSlug}\n\nNo MDX content available for this app.`;
      })
      .then((text) => {
        setContent(text);
        setIsLoading(false);
      })
      .catch(() => {
        setContent(`# ${appSlug}\n\nFailed to load MDX content.`);
        setIsLoading(false);
      });
  }, [appSlug, initialContent]);

  const renderedContent = useMemo(() => {
    if (!content) return null;
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Persona / feature-flag / role content gate
          // MDX usage: <context-block persona="ai-indie">...</context-block>
          "context-block": ({
            node: _node,
            ...props
          }: { node?: unknown; [key: string]: unknown }) => {
            return <ContextBlock {...(props as Record<string, string>)} />;
          },
          // Interactive tool surface for executing MCP tools inline
          toolsurface: ({ node: _node, ...props }: { node?: unknown; [key: string]: unknown }) => {
            const name = (props as Record<string, string>).name;
            if (!name) return null;
            return (
              <div className="my-5">
                <Suspense
                  fallback={
                    <div className="rubik-panel p-4 flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading tool surface...</span>
                    </div>
                  }
                >
                  <ToolSurface toolName={name} defaultExpanded />
                </Suspense>
              </div>
            );
          },
          // Custom component for embedded tool results
          toolresult: ({ node: _node, ...props }: { node?: unknown; [key: string]: unknown }) => {
            const name = (props as Record<string, string>).name || "unknown";
            return (
              <div className="rubik-panel my-5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs font-mono font-semibold uppercase tracking-[0.12em] text-primary">
                    {name}
                  </span>
                </div>
                <div className="text-sm leading-7 text-muted-foreground">
                  {(props as Record<string, ReactNode>).children || "Loading result..."}
                </div>
              </div>
            );
          },
          pre: ({ children }) => {
            const codeBlock = getCodeBlock(children);
            const commands =
              codeBlock && isExecutableShellLanguage(codeBlock.language)
                ? resolveMcpCommandBlock(codeBlock.text)
                : null;

            if (commands) {
              return (
                <div className="my-4 space-y-3">
                  {commands.map((command, index) => (
                    <MdxCommandCard
                      key={`${command.command}-${index}`}
                      command={command.command}
                      toolName={command.toolName}
                      args={command.args}
                    />
                  ))}
                </div>
              );
            }

            return (
              <pre className="rubik-signal-rail my-5 overflow-x-auto rounded-[calc(var(--radius-panel)-0.2rem)] p-4 text-sm">
                {children}
              </pre>
            );
          },
          // Style standard markdown elements
          h1: ({ children }) => (
            <h1 className="mt-10 mb-4 text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-8 mb-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 text-xl font-semibold tracking-[-0.03em] text-foreground">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 text-[0.97rem] leading-8 text-foreground/90">{children}</p>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.startsWith("language-");
            if (isBlock) {
              return <code className="text-xs font-mono text-foreground">{children}</code>;
            }
            return (
              <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-primary">
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold border-b border-border bg-muted/30 text-xs uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b border-border/50 text-sm">{children}</td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-5 border-l-2 border-primary pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  }, [content]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-16 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`rubik-panel flex h-full flex-col overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-[-0.02em]">MDX &mdash; {appSlug}</span>
        </div>
        <span className="rubik-chip px-2.5 py-1 text-[10px]">editorial surface</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl p-6 sm:p-8">{renderedContent}</div>
      </div>
    </div>
  );
}

function getCodeBlock(children: ReactNode): { language?: string; text: string } | null {
  const child = Array.isArray(children) ? children[0] : children;
  if (!isValidElement(child)) return null;

  const props = child.props as { className?: string; children?: ReactNode };
  const language = props.className?.replace("language-", "");
  const text = getNodeText(props.children).trim();

  if (!text) return null;

  return { language, text };
}

function getNodeText(node: ReactNode): string {
  if (Array.isArray(node)) {
    return node.map((item) => getNodeText(item)).join("");
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (isValidElement(node)) {
    return getNodeText((node.props as { children?: ReactNode }).children);
  }

  return "";
}

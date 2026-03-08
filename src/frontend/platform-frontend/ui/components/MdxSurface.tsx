import { useState, useEffect, useMemo, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { FileText, Loader2 } from "lucide-react";
import { MdxCommandCard } from "./MdxCommandCard";
import { isExecutableShellLanguage, resolveMcpCommandBlock } from "./mcp-command-line";

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
          // Custom component for embedded tool results
          toolresult: ({ node: _node, ...props }: { node?: unknown; [key: string]: unknown }) => {
            const name = (props as Record<string, string>).name || "unknown";
            return (
              <div className="my-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs font-mono font-bold text-primary">{name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
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
              <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4">
                {children}
              </pre>
            );
          },
          // Style standard markdown elements
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold text-foreground mt-8 mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-semibold text-foreground mt-6 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold text-foreground mt-4 mb-2">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm text-foreground/90 leading-relaxed mb-3">{children}</p>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.startsWith("language-");
            if (isBlock) {
              return <code className="text-xs font-mono text-foreground">{children}</code>;
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono text-primary">
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
            <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary pl-4 my-4 italic text-muted-foreground">
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
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="font-semibold text-sm">MDX &mdash; {appSlug}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        {renderedContent}
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

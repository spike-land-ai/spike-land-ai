import { ReadAloudParagraph } from "@/components/blog/ReadAloudButton";
import { parseWikiLinks } from "@/lib/learnit/wiki-links";
import logger from "@/lib/logger";
import { MDXRemote } from "next-mdx-remote/rsc";
import React from "react";
import remarkGfm from "remark-gfm";
import { WikiLink } from "./wiki-link";

const components = {
  // Custom component mapping for wiki links
  WikiLink: WikiLink,
  // Handle internal learnit links
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (props.href && props.href.startsWith("/learnit/")) {
      return <WikiLink topic={props.children as string} className="no-underline" />;
    }
    return <a {...props}>{props.children}</a>;
  },
  // Paragraphs with read-aloud button
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <ReadAloudParagraph>
      <p {...props} />
    </ReadAloudParagraph>
  ),
};

/**
 * Sanitize AI-generated markdown content for safe MDX compilation.
 * MDX treats `{...}` as JSX expressions and `<...>` as JSX elements,
 * which causes acorn parse errors when content contains math notation,
 * template syntax, or other non-JSX uses of these characters.
 */
function sanitizeMdxContent(content: string): string {
  const lines = content.split("\n");
  let inCodeBlock = false;
  const result: string[] = [];

  for (const line of lines) {
    // Track fenced code blocks — don't modify content inside them
    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Outside code blocks: escape curly braces that aren't part of valid MDX components
    // We want to be careful not to break math blocks if they contain braces,
    // but math blocks ($...$ or $$...$$) are often on the same line or spanned.

    let sanitized = line;

    // First, temporarily hide math blocks to avoid escaping their braces
    // This is a simple heuristic: hide everything between $ or $$
    const mathBlocks: string[] = [];
    sanitized = sanitized.replace(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g, (match) => {
      const placeholder = `__MATH_BLOCK_${mathBlocks.length}__`;
      mathBlocks.push(match);
      return placeholder;
    });

    // Escape `{` and `}` with their HTML entity equivalents
    sanitized = sanitized.replace(/\{/g, "&#123;");
    sanitized = sanitized.replace(/\}/g, "&#125;");

    // Escape `<` and `>` that look like math/comparison operators (not HTML tags)
    // Match `<` not followed by a valid HTML/JSX tag pattern (letter or /)
    sanitized = sanitized.replace(/<(?![a-zA-Z/!])/g, "&lt;");

    // Restore math blocks
    mathBlocks.forEach((block, i) => {
      sanitized = sanitized.replace(`__MATH_BLOCK_${i}__`, block);
    });

    result.push(sanitized);
  }

  return result.join("\n");
}

interface LearnItContentProps {
  content: string; // MDX content
}

export async function LearnItContent({ content }: LearnItContentProps) {
  const [{ default: rehypePrettyCode }, { default: remarkMath }, { default: rehypeKatex }] =
    await Promise.all([
      import("rehype-pretty-code"),
      import("remark-math"),
      import("rehype-katex"),
    ]);

  // Parse wiki-links [[topic]] to markdown links before rendering
  const { content: parsedContent } = parseWikiLinks(content);
  // Sanitize content to escape MDX-problematic characters
  const safeContent = sanitizeMdxContent(parsedContent);

  try {
    return (
      <div className="prose-blog max-w-none">
        <MDXRemote
          source={safeContent}
          components={components}
          options={{
            mdxOptions: {
              remarkPlugins: [remarkGfm, remarkMath],
              rehypePlugins: [
                rehypeKatex,
                [
                  rehypePrettyCode,
                  {
                    theme: "github-dark",
                    keepBackground: true,
                    onVisitLine(node: { children: unknown[] }) {
                      if (node.children?.length === 0) {
                        node.children = [{ type: "text", value: " " }];
                      }
                    },
                  },
                ],
              ],
            },
          }}
        />
      </div>
    );
  } catch (error) {
    // If MDX compilation still fails, fall back to rendering as plain markdown
    logger.error("MDX compilation failed, falling back to plain rendering", {
      error,
    });
    return <PlainMarkdownFallback content={parsedContent} />;
  }
}

/**
 * Fallback renderer when MDX compilation fails.
 * Renders content as plain formatted text with basic markdown structure.
 */
function PlainMarkdownFallback({ content }: { content: string }) {
  const lines = content.split("\n");
  let inCodeBlock = false;
  const elements: React.ReactNode[] = [];
  let codeLines: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trimStart();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <pre
            key={`code-${i}`}
            className="bg-zinc-900 text-zinc-100 rounded-lg p-4 overflow-x-auto my-4"
          >
            <code className={codeLang ? `language-${codeLang}` : undefined}>
              {codeLines.join("\n")}
            </code>
          </pre>,
        );
        codeLines = [];
        codeLang = "";
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
        codeLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      elements.push(<br key={`br-${i}`} />);
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-2xl font-bold mt-8 mb-4">
          {trimmed.slice(3)}
        </h2>,
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-xl font-semibold mt-6 mb-3">
          {trimmed.slice(4)}
        </h3>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={`li-${i}`} className="ml-6 list-disc">
          {trimmed.slice(2)}
        </li>,
      );
    } else {
      elements.push(
        <p key={`p-${i}`} className="my-2 leading-relaxed">
          {line}
        </p>,
      );
    }
  }

  return <div className="prose-blog max-w-none">{elements}</div>;
}

"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo } from "react";

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

// Extract plugins to a static constant to avoid re-creation on every render
const plugins = [remarkGfm];

/**
 * Compact markdown renderer tailored for the chat widget.
 * Uses smaller typography and tighter spacing than the full-page MarkdownRenderer.
 */
export const ChatMarkdown = memo(
  function ChatMarkdown({ content, className }: ChatMarkdownProps) {
    return (
      <div
        className={cn(
          "prose prose-invert prose-sm max-w-none",
          // Compact headings
          "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mt-3 prose-headings:mb-1.5",
          "prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-h4:text-sm",
          // Body text
          "prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:my-1.5 prose-p:whitespace-pre-wrap",
          // Links
          "prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline",
          // Bold / emphasis
          "prose-strong:text-zinc-100 prose-strong:font-semibold",
          "prose-em:text-zinc-200",
          // Inline code
          "prose-code:text-amber-300 prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono",
          "prose-code:before:content-none prose-code:after:content-none",
          // Code blocks
          "prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg prose-pre:text-xs prose-pre:my-2 prose-pre:p-2",
          "prose-pre:overflow-x-auto",
          // Lists
          "prose-li:text-zinc-300 prose-li:my-0.5",
          "prose-ul:my-1.5 prose-ol:my-1.5",
          // Blockquotes
          "prose-blockquote:border-l-amber-500/50 prose-blockquote:bg-white/5 prose-blockquote:rounded-r-lg prose-blockquote:py-0.5 prose-blockquote:px-3 prose-blockquote:my-2 prose-blockquote:not-italic",
          // Tables
          "prose-th:border prose-th:border-white/10 prose-th:bg-white/5 prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:text-xs prose-th:font-semibold",
          "prose-td:border prose-td:border-white/10 prose-td:px-2 prose-td:py-1 prose-td:text-xs",
          // Dividers
          "prose-hr:border-white/10 prose-hr:my-3",
          className,
        )}
      >
        <ReactMarkdown remarkPlugins={plugins}>{content}</ReactMarkdown>
      </div>
    );
  },
);

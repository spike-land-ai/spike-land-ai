import { useState, useEffect, useCallback, memo } from "react";
import { ChevronDown, ChevronRight, Wrench, AlertCircle, Copy, Check } from "lucide-react";
import { useDarkMode } from "../hooks/useDarkMode";
import { cn } from "../../styling/cn";
import { sanitizeUrl } from "../../core-logic/lib/security";
import type { ChatMessage as ChatMessageType } from "../hooks/useChat";

interface AiChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

// ---------------------------------------------------------------------------
// Relative timestamp
// ---------------------------------------------------------------------------

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function RelativeTimestamp({
  timestamp,
  className,
}: {
  timestamp: number;
  className?: string;
}) {
  const [label, setLabel] = useState(() => relativeTime(timestamp));

  useEffect(() => {
    const tick = () => setLabel(relativeTime(timestamp));
    // update every 30 s — fine-grained enough for "just now" / "Xm ago"
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timestamp]);

  return <span className={className}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Whole-message copy button
// ---------------------------------------------------------------------------

function CopyButton({ text, isUser }: { text: string; isUser: boolean }) {
  const { isDarkMode } = useDarkMode();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "p-1.5 rounded-lg transition-all",
        isDarkMode
          ? isUser
            ? "hover:bg-black/10 text-black/50 hover:text-black"
            : "hover:bg-white/5 text-white/30 hover:text-white"
          : isUser
          ? "hover:bg-black/10 text-primary-foreground/60 hover:text-primary-foreground"
          : "hover:bg-muted text-muted-foreground hover:text-foreground",
      )}
      aria-label="Copy message"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Per-code-block copy button (appears on hover)
// ---------------------------------------------------------------------------

function CodeBlockCopyButton({ code, isDarkMode }: { code: string; isDarkMode: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "absolute top-2.5 right-2.5 p-1.5 rounded-lg opacity-0 group-hover/codeblock:opacity-100",
        "transition-opacity duration-150",
        isDarkMode
          ? "bg-white/10 hover:bg-white/20 text-white/60 hover:text-white"
          : "bg-black/8 hover:bg-black/15 text-black/50 hover:text-black",
      )}
      aria-label="Copy code"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tool call card
// ---------------------------------------------------------------------------

function ToolCallCard({
  tc,
}: {
  tc: NonNullable<ChatMessageType["toolCalls"]>[number];
}) {
  const { isDarkMode } = useDarkMode();
  const [expanded, setExpanded] = useState(false);
  const isImage =
    tc.result !== undefined &&
    /https?:\/\/.*\.(png|jpg|jpeg|webp|gif)/i.test(tc.result);
  const imageUrl = isImage
    ? tc.result!.match(/https?:\/\/[^\s"]+\.(png|jpg|jpeg|webp|gif)/i)?.[0]
    : null;

  return (
    <div
      className={cn(
        "mt-3 rounded-2xl border text-[11px] overflow-hidden transition-all",
        isDarkMode
          ? "dark:glass-card border-primary/10"
          : "bg-muted border-border",
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left",
          isDarkMode ? "hover:bg-white/5" : "hover:bg-muted/80",
        )}
      >
        <div
          className={cn(
            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
            isDarkMode ? "bg-primary/10" : "bg-success/10",
          )}
        >
          <Wrench
            className={cn(
              "w-3 h-3",
              isDarkMode ? "text-primary" : "text-success",
            )}
          />
        </div>
        <span
          className={cn(
            "font-bold uppercase tracking-widest truncate",
            isDarkMode ? "text-primary-light/60" : "text-muted-foreground",
          )}
        >
          {tc.name}
        </span>
        {tc.status === "pending" && (
          <span
            className={cn(
              "ml-auto flex items-center gap-1.5 font-black uppercase tracking-tighter",
              isDarkMode ? "text-primary-light" : "text-primary",
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-primary" />
            Active
          </span>
        )}
        {tc.status === "error" && (
          <AlertCircle className="ml-auto w-3.5 h-3.5 text-destructive" />
        )}
        {tc.status === "done" && (
          <div className="ml-auto">
            {expanded ? (
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5",
                  isDarkMode ? "text-primary/50" : "text-muted-foreground",
                )}
              />
            ) : (
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5",
                  isDarkMode ? "text-primary/50" : "text-muted-foreground",
                )}
              />
            )}
          </div>
        )}
      </button>
      {expanded && tc.result && (
        <div
          className={cn(
            "px-4 py-4 border-t",
            isDarkMode
              ? "border-primary/10 bg-black/30"
              : "border-border bg-background/50",
          )}
        >
          {imageUrl && (
            <div className="rounded-xl overflow-hidden border border-border mb-3 shadow-lg">
              <img
                src={imageUrl}
                alt="Tool Output"
                className="w-full h-auto max-h-64 object-cover"
              />
            </div>
          )}
          <pre
            className={cn(
              "font-medium whitespace-pre-wrap break-all max-h-40 overflow-y-auto leading-relaxed",
              isDarkMode ? "text-gray-500" : "text-muted-foreground",
            )}
          >
            {tc.result.length > 1000
              ? `${tc.result.slice(0, 1000)}...`
              : tc.result}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading dots — shown when the assistant message is completely empty
// ---------------------------------------------------------------------------

function LoadingDots() {
  return (
    <span className="inline-flex gap-1.5 items-center px-2 py-1">
      <span
        className="w-1 h-1 rounded-full animate-bounce bg-primary"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-1 h-1 rounded-full animate-bounce bg-primary"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1 h-1 rounded-full animate-bounce bg-primary"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Streaming cursor — blinking "|" appended while tokens are still arriving
// ---------------------------------------------------------------------------

function StreamingCursor({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <span
      className={cn(
        "inline-block w-[2px] h-[1em] ml-0.5 align-middle rounded-sm animate-[pulse_1s_ease-in-out_infinite]",
        isDarkMode ? "bg-primary-light/70" : "bg-primary/70",
      )}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Markdown renderer — supports bold, italic, links, inline code, code blocks
// ---------------------------------------------------------------------------

/**
 * Splits `text` on fenced code blocks first (``` ... ```) so they are rendered
 * as styled <pre><code> elements with a hover copy button. Everything else is
 * passed through the inline-markdown splitter.
 */
function MessageContent({
  text,
  isUser,
  isDarkMode,
  isStreaming,
}: {
  text: string;
  isUser: boolean;
  isDarkMode: boolean;
  isStreaming?: boolean;
}) {
  // Split on fenced code blocks: ```[lang]\n...\n```
  const segments = text.split(/(```[\s\S]*?```)/g);

  return (
    <span className="whitespace-pre-wrap">
      {segments.map((segment, segIdx) => {
        const fenceMatch = segment.match(/^```(\w*)\n?([\s\S]*?)```$/);
        if (fenceMatch) {
          const lang = fenceMatch[1] || "text";
          const code = fenceMatch[2] ?? "";
          return (
            <span
              key={segIdx}
              className="relative group/codeblock block my-2 rounded-xl overflow-hidden"
            >
              {/* language label */}
              <span
                className={cn(
                  "flex items-center justify-between px-4 py-1.5 text-[10px] font-black uppercase tracking-widest",
                  isDarkMode
                    ? "bg-white/5 text-white/30 border-b border-white/8"
                    : "bg-muted text-muted-foreground border-b border-border",
                )}
              >
                {lang}
                <CodeBlockCopyButton code={code} isDarkMode={isDarkMode} />
              </span>
              <pre
                className={cn(
                  "p-4 text-[12px] leading-relaxed overflow-x-auto font-mono",
                  isDarkMode
                    ? "bg-black/40 text-gray-300"
                    : "bg-muted/60 text-foreground",
                )}
              >
                <code>{code}</code>
              </pre>
            </span>
          );
        }

        // Inline markdown: bold, italic, inline-code, links
        const parts = segment.split(
          /(`[^`]+`|\*\*.*?\*\*|_.*?_|\[.*?\]\(.*?\))/g,
        );

        return (
          <span key={segIdx}>
            {parts.map((part, i) => {
              // Inline code
              if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
                const code = part.slice(1, -1);
                return (
                  <code
                    key={i}
                    className={cn(
                      "px-1.5 py-0.5 rounded-md text-[11px] font-mono",
                      isDarkMode
                        ? "bg-white/10 text-primary-light"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {code}
                  </code>
                );
              }
              // Bold
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong
                    key={i}
                    className={cn(
                      isUser ? "font-black" : "font-bold",
                      !isUser &&
                        (isDarkMode ? "text-white" : "text-foreground"),
                    )}
                  >
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              // Italic
              if (part.startsWith("_") && part.endsWith("_")) {
                return (
                  <em key={i} className="italic">
                    {part.slice(1, -1)}
                  </em>
                );
              }
              // Link
              const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
              if (linkMatch) {
                return (
                  <a
                    key={i}
                    href={sanitizeUrl(linkMatch[2])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "underline hover:opacity-80 transition-opacity",
                      isDarkMode
                        ? isUser
                          ? "text-primary-foreground"
                          : "text-primary-light"
                        : "text-primary",
                    )}
                  >
                    {linkMatch[1]}
                  </a>
                );
              }
              // Plain text — attach streaming cursor to final segment's last part
              const isLastPart =
                isStreaming &&
                segIdx === segments.length - 1 &&
                i === parts.length - 1;
              return (
                <span key={i}>
                  {part}
                  {isLastPart && <StreamingCursor isDarkMode={isDarkMode} />}
                </span>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export const AiChatMessage = memo(function AiChatMessage({
  message,
  isStreaming,
}: AiChatMessageProps) {
  const { isDarkMode } = useDarkMode();
  const isUser = message.role === "user";
  const isEmpty =
    !message.content &&
    (!message.toolCalls || message.toolCalls.length === 0);

  // A streaming assistant message that already has content: show cursor but
  // not LoadingDots. An empty streaming message still shows LoadingDots.
  const showStreamingCursor =
    isStreaming && !isUser && !!message.content;

  return (
    <div className={cn("flex group", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[90%] p-5",
          isDarkMode
            ? isUser
              ? "bg-primary text-primary-foreground rounded-3xl rounded-tr-lg shadow-[0_10px_30px_var(--primary-glow)]"
              : "dark:glass-card text-gray-200 rounded-3xl rounded-tl-lg"
            : isUser
            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
            : "bg-card border border-border text-card-foreground rounded-2xl rounded-tl-sm",
        )}
      >
        {isEmpty ? (
          <LoadingDots />
        ) : (
          <div className="flex gap-4">
            <div className="flex-1 space-y-3 overflow-hidden">
              {message.content && (
                <div
                  className={cn(
                    "text-sm",
                    isUser ? "font-bold" : "font-medium leading-relaxed",
                  )}
                >
                  <MessageContent
                    text={message.content}
                    isUser={isUser}
                    isDarkMode={isDarkMode}
                    {...(showStreamingCursor ? { isStreaming: true } : {})}
                  />
                </div>
              )}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="space-y-2">
                  {message.toolCalls.map((tc, i) => (
                    <ToolCallCard key={`${tc.name}-${i}`} tc={tc} />
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={message.content || ""} isUser={isUser} />
            </div>
          </div>
        )}

        {/* Timestamp */}
        <RelativeTimestamp
          timestamp={message.timestamp}
          className={cn(
            "block text-[9px] font-black uppercase tracking-widest mt-3 opacity-40",
            isUser
              ? "text-primary-foreground/80 text-right"
              : isDarkMode
              ? "text-primary-light/60"
              : "text-muted-foreground",
          )}
        />
      </div>
    </div>
  );
});

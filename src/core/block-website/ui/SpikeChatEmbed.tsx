"use client";

import { Loader2, MessageCircle, Send, Wrench } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface SpikeChatEmbedProps {
  channelSlug?: string | undefined;
  workspaceSlug?: string | undefined;
  guestAccess?: boolean | undefined;
  height?: number | string | undefined;
  blogSlug?: string | undefined;
  blogTitle?: string | undefined;
  contentSnippet?: string | undefined;
  persona?: string | undefined;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{
    name: string;
    status: "pending" | "done" | "error";
  }>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

let msgId = 0;
function nextId() {
  return `blog-chat-${Date.now()}-${++msgId}`;
}

function BlogAIChat({
  blogSlug,
  blogTitle,
  contentSnippet,
  persona,
  height,
}: {
  blogSlug: string;
  blogTitle?: string | undefined;
  contentSnippet?: string | undefined;
  persona?: string | undefined;
  height: number | string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [stage, setStage] = useState<string>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMsg: ChatMessage = { id: nextId(), role: "user", content: content.trim() };
      const assistantMsg: ChatMessage = {
        id: nextId(),
        role: "assistant",
        content: "",
        toolCalls: [],
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsStreaming(true);
      setStage("classify");

      try {
        abortRef.current = new AbortController();

        const isLocal =
          typeof window !== "undefined" && window.location.hostname.includes("localhost");
        const baseUrl = isLocal ? "http://localhost:8787" : "";

        const history = messages.map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch(`${baseUrl}/api/spike-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message: content.trim(),
            history,
            persona,
            pageContext: {
              url: typeof window !== "undefined" ? window.location.href : undefined,
              title: blogTitle,
              slug: blogSlug,
              contentSnippet: contentSnippet?.slice(0, 2000),
            },
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(errBody || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            // Skip SSE event ID lines (tracked for future stream resumption)
            if (line.startsWith("id: ")) continue;
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed: unknown = JSON.parse(data);
              if (!isObject(parsed)) continue;

              const eventType = typeof parsed["type"] === "string" ? parsed["type"] : "";

              if (eventType === "stage_update" && typeof parsed["stage"] === "string") {
                setStage(parsed["stage"]);
              } else if (eventType === "text_delta" && typeof parsed["text"] === "string") {
                const delta = parsed["text"];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m,
                  ),
                );
              } else if (eventType === "tool_call_start" && typeof parsed["name"] === "string") {
                const toolName = parsed["name"];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolCalls: [
                            ...(m.toolCalls ?? []),
                            { name: toolName, status: "pending" as const },
                          ],
                        }
                      : m,
                  ),
                );
              } else if (
                eventType === "tool_call_end" &&
                typeof parsed["toolCallId"] === "string"
              ) {
                const endName = typeof parsed["name"] === "string" ? parsed["name"] : "";
                const endStatus =
                  parsed["status"] === "error" ? ("error" as const) : ("done" as const);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolCalls: (m.toolCalls ?? []).map((tc) =>
                            tc.name === endName && tc.status === "pending"
                              ? { ...tc, status: endStatus }
                              : tc,
                          ),
                        }
                      : m,
                  ),
                );
              }
            } catch {
              // skip malformed SSE
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id && !m.content
              ? { ...m, content: "Sorry, something went wrong. Please try again." }
              : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        setStage("idle");
        abortRef.current = null;
      }
    },
    [isStreaming, messages, blogSlug, blogTitle, contentSnippet, persona],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const stageLabel =
    stage === "classify"
      ? "Understanding..."
      : stage === "plan"
        ? "Planning..."
        : stage === "execute"
          ? "Responding..."
          : stage === "extract"
            ? "Learning..."
            : null;

  return (
    <div
      className="relative flex flex-col my-12 w-full overflow-hidden rounded-[2rem] border border-border/60 bg-background/50 shadow-[var(--panel-shadow)] backdrop-blur"
      style={{ height }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/40 px-6 py-3">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold tracking-tight">Ask about this article</span>
        {stageLabel && (
          <span className="ml-auto text-xs text-muted-foreground animate-pulse">{stageLabel}</span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground/60 text-center mt-8">
            Ask a question about {blogTitle ? `"${blogTitle}"` : "this article"}
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-foreground"
              }`}
            >
              {msg.content || (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Thinking...
                </span>
              )}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.toolCalls.map((tc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <Wrench className="h-3 w-3" />
                      <span>{tc.name}</span>
                      {tc.status === "pending" && <Loader2 className="h-3 w-3 animate-spin" />}
                      {tc.status === "done" && <span className="text-green-500">done</span>}
                      {tc.status === "error" && <span className="text-red-500">failed</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border/40 px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this article..."
          disabled={isStreaming}
          className="flex-1 rounded-xl border border-border/60 bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-xl bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function ChannelEmbed({
  channelSlug,
  workspaceSlug,
  guestAccess,
  height,
}: {
  channelSlug: string;
  workspaceSlug: string;
  guestAccess: boolean;
  height: number | string;
}) {
  const isLocal = typeof window !== "undefined" && window.location.hostname.includes("localhost");
  const configuredBaseUrl = "/";
  const baseUrl = isLocal ? "http://localhost:8787" : configuredBaseUrl;
  const embedUrl = new URL(
    `/embed/${workspaceSlug}/${channelSlug}?guest=${guestAccess}`,
    isLocal
      ? baseUrl
      : typeof window !== "undefined"
        ? window.location.origin
        : "https://spike.land",
  ).toString();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
    baseUrl ? "loading" : "unavailable",
  );

  useEffect(() => {
    if (!baseUrl) return;
    const timer = setTimeout(() => {
      setStatus((s) => (s === "loading" ? "unavailable" : s));
    }, 8000);
    return () => clearTimeout(timer);
  }, [baseUrl]);

  return (
    <div
      className="relative my-12 w-full overflow-hidden rounded-[2rem] border border-border/60 bg-background/50 shadow-[var(--panel-shadow)] backdrop-blur"
      style={{ height }}
    >
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-primary z-10 backdrop-blur-sm">
          <Loader2 className="mb-4 h-8 w-8 animate-spin" />
          <p className="text-sm font-medium tracking-[0.24em] uppercase">
            Loading Universal Interface...
          </p>
        </div>
      )}
      {status === "unavailable" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-muted-foreground z-10 backdrop-blur-sm gap-4">
          <MessageCircle className="h-10 w-10 text-primary/40" />
          <p className="text-lg font-black tracking-tight text-foreground">
            spike-chat is coming soon
          </p>
          <p className="text-sm font-medium text-muted-foreground/70 max-w-md text-center leading-relaxed">
            The live chat embed for <span className="font-bold text-primary">#{channelSlug}</span>{" "}
            isn't deployed yet. Once it's live, anyone will be able to join the conversation right
            here.
          </p>
        </div>
      )}
      {status !== "unavailable" && (
        <iframe
          src={embedUrl}
          title={`Spike Chat - ${channelSlug}`}
          className="h-full w-full border-0"
          onLoad={() => setStatus("ready")}
          allow="fullscreen; clipboard-read; clipboard-write"
        />
      )}
    </div>
  );
}

export function SpikeChatEmbed({
  channelSlug,
  workspaceSlug,
  guestAccess = false,
  height = 500,
  blogSlug,
  blogTitle,
  contentSnippet,
  persona,
}: SpikeChatEmbedProps) {
  // AI blog chat mode when blogSlug is provided
  if (blogSlug) {
    return (
      <BlogAIChat
        blogSlug={blogSlug}
        blogTitle={blogTitle}
        contentSnippet={contentSnippet}
        persona={persona}
        height={height}
      />
    );
  }

  // Channel iframe mode (existing behavior)
  return (
    <ChannelEmbed
      channelSlug={channelSlug ?? "general"}
      workspaceSlug={workspaceSlug ?? "default"}
      guestAccess={guestAccess}
      height={height}
    />
  );
}

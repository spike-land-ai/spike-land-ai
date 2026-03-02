"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, MessageCircle, Paperclip, Search, Send, Wrench, X } from "lucide-react";
import { useSession } from "@/lib/auth/client/hooks";
import { UserAvatar } from "@/components/auth/user-avatar";
import { useAuthDialog } from "@/components/auth/AuthDialogProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type AgentContentBlock, type AgentMessage, useAgentChat } from "@/hooks/useAgentChat";
import { ToolCallCard } from "./ToolCallCard";
import { ChatMarkdown } from "./ChatMarkdown";
import { ImageAnnotator } from "./ImageAnnotator";
// html-to-image is loaded dynamically only when screenshot is triggered

export function SiteChat() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { openAuthDialog } = useAuthDialog();
  const isSignedIn = !!session;
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<{ type: string; data: string; name: string }[]>(
    [],
  );
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const chatTitle = "spike.land Agent";
  const [placeholder, setPlaceholder] = useState("Ask anything, report bugs, or send a message...");

  useEffect(() => {
    import("@/lib/constants/placeholders").then((m) => {
      setPlaceholder(m.getRandomPlaceholder());
    });
  }, []);

  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return "ssr";
    const stored = sessionStorage.getItem("site-chat-session-id");
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem("site-chat-session-id", id);
    return id;
  });

  const extraBody = useMemo(
    () => ({
      route: pathname,
      pageTitle: typeof document !== "undefined" ? document.title : "",
    }),
    [pathname],
  );

  const { messages, isStreaming, currentTurn, maxTurns, error, sendMessage } = useAgentChat(
    sessionId,
    "/api/agent-loop",
    extraBody,
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    window.dispatchEvent(new CustomEvent("chat-opened"));
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isStreaming) return;
    setInput("");
    const currentAttachments = [...attachments];
    setAttachments([]);
    await sendMessage(trimmed, currentAttachments);
  }, [input, isStreaming, attachments, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <AnimatePresence mode="wait">
      {!isOpen ? (
        <motion.div
          layoutId="chat-window"
          className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-1"
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >
          <motion.button
            layoutId="chat-content"
            onClick={handleOpen}
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-zinc-950 shadow-lg transition-all hover:bg-amber-400"
            aria-label={chatTitle}
          >
            <MessageCircle className="h-6 w-6" />

            {isSignedIn ? (
              <span
                role="presentation"
                className="absolute -right-2 -top-2 z-10 p-0 border-none bg-transparent cursor-auto"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <UserAvatar className="h-7 w-7 border-2 border-amber-500 hover:scale-105 transition-transform" />
              </span>
            ) : (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-300" />
              </span>
            )}
          </motion.button>
          {!isSignedIn && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              type="button"
              onClick={() => openAuthDialog({ callbackUrl: pathname })}
              className="text-[10px] text-zinc-500 hover:text-white transition-colors"
            >
              Sign in
            </motion.button>
          )}
        </motion.div>
      ) : (
        <motion.div
          layoutId="chat-window"
          className="fixed bottom-0 left-0 right-0 z-50 flex h-[85dvh] flex-col bg-zinc-950 shadow-2xl overflow-hidden sm:inset-auto sm:bottom-6 sm:right-6 sm:h-auto sm:max-h-[min(800px,calc(100dvh-6rem))] sm:w-[420px] sm:rounded-2xl sm:border sm:border-white/10 sm:bg-zinc-900/90 sm:backdrop-blur-xl"
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >
          <motion.div layoutId="chat-content" className="flex flex-1 flex-col overflow-hidden">
            {/* Mobile Drag Handle */}
            <div className="flex justify-center pt-2 sm:hidden">
              <div className="h-1.5 w-12 rounded-full bg-white/10" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 sm:bg-transparent">
              <div className="flex items-center gap-2">
                {isSignedIn ? (
                  <UserAvatar className="h-8 w-8 border border-white/10" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white">{chatTitle}</span>
                  {isStreaming && currentTurn > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <Wrench className="h-3 w-3 animate-spin-slow" />
                      Processing... {currentTurn}/{maxTurns}
                    </span>
                  )}
                  {!isSignedIn && !isStreaming && (
                    <button
                      type="button"
                      onClick={() => openAuthDialog({ callbackUrl: pathname })}
                      className="text-left text-[10px] text-zinc-500 hover:text-white transition-colors underline underline-offset-2"
                    >
                      Sign in to save history
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
                  className="rounded-lg p-2 text-zinc-400 transition-all hover:bg-white/10 hover:text-white group relative active:scale-95"
                  aria-label="Search"
                >
                  <Search className="h-5 w-5" />
                  <span className="absolute -bottom-10 right-0 rounded bg-zinc-800 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none shadow-xl border border-white/5">
                    Cmd + K
                  </span>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-zinc-400 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                  aria-label="Close chat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <MessageList
              messages={messages}
              messagesEndRef={messagesEndRef}
              placeholder={placeholder}
            />

            {/* Error */}
            {error && (
              <div className="mx-4 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto p-3 border-t border-white/10 bg-black/20">
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="relative h-16 w-16 shrink-0 rounded overflow-hidden border border-white/20"
                  >
                    <Image
                      src={att.data}
                      alt="attachment"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Section */}
            <div className="border-t border-white/10 bg-zinc-900/80 p-4 pb-safe-offset-4 backdrop-blur-md sm:bg-zinc-900/50 sm:p-3 sm:pb-3">
              <div className="flex items-end gap-2 rounded-[24px] border border-white/10 bg-black/40 p-2 focus-within:border-amber-500/50 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-2xl">
                <div className="flex shrink-0 gap-1 pb-0.5 pl-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files) return;
                      Array.from(files).forEach((file) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const result = ev.target?.result as string;
                          if (result) {
                            setAttachments((prev) => [
                              ...prev,
                              {
                                type: file.type,
                                data: result,
                                name: file.name,
                              },
                            ]);
                          }
                        };
                        reader.readAsDataURL(file);
                      });
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach File"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
                    title="Capture Screenshot"
                    onClick={async () => {
                      setIsOpen(false);
                      // Wait for the chat window to animate out before capturing
                      setTimeout(async () => {
                        try {
                          const { toJpeg } = await import("html-to-image");
                          const dataUrl = await toJpeg(document.body, {
                            quality: 0.8,
                            pixelRatio: window.devicePixelRatio || 1,
                          });
                          setScreenshotPreview(dataUrl);
                        } catch (err) {
                          console.error("Screenshot failed:", err);
                        } finally {
                          setIsOpen(true);
                        }
                      }, 300);
                    }}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className="min-h-[44px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-3 py-3 text-base sm:text-sm text-white shadow-none placeholder:text-zinc-500 focus-visible:bg-transparent focus-visible:ring-0 leading-relaxed"
                  rows={1}
                  disabled={isStreaming}
                />
                <div className="shrink-0 pb-1 pr-1">
                  <Button
                    onClick={handleSend}
                    disabled={(!input.trim() && attachments.length === 0) || isStreaming}
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-full bg-amber-500 text-zinc-950 shadow-lg transition-all hover:scale-110 hover:bg-amber-400 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <Send className="h-5 w-5 ml-0.5" />
                  </Button>
                </div>
              </div>
            </div>

            {screenshotPreview && (
              <ImageAnnotator
                initialImage={screenshotPreview}
                onSave={(annotatedImage) => {
                  setAttachments((prev) => [
                    ...prev,
                    {
                      type: "image/png",
                      data: annotatedImage,
                      name: "screenshot.png",
                    },
                  ]);
                  setScreenshotPreview(null);
                }}
                onCancel={() => setScreenshotPreview(null)}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Memoized message list to prevent re-renders when input state changes
 */
const MessageList = memo(function MessageList({
  messages,
  messagesEndRef,
  placeholder,
}: {
  messages: AgentMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  placeholder: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 scroll-smooth">
      {messages.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500">
            <MessageCircle className="h-8 w-8" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">How can I help you today?</h3>
          <p className="max-w-[200px] text-sm text-zinc-500 leading-relaxed">{placeholder}</p>
        </div>
      )}

      {messages.map((msg) => (
        <AgentMessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={messagesEndRef} className="h-2 shrink-0" />
    </div>
  );
});

/**
 * Memoized message bubble to prevent re-renders of previous messages
 * during streaming updates. Only the active message will re-render.
 */
const AgentMessageBubble = memo(function AgentMessageBubble({
  message,
}: {
  message: AgentMessage;
}) {
  const isUser = message.role === "user";
  const hasContent = message.blocks.length > 0;

  // Group blocks for rendering (group consecutive images)
  const renderBlocks = useMemo(() => {
    type RenderBlock =
      | AgentContentBlock
      | {
          type: "image_group";
          blocks: Extract<AgentContentBlock, { type: "image" }>[];
        };
    const result: RenderBlock[] = [];
    let currentImages: Extract<AgentContentBlock, { type: "image" }>[] = [];

    for (const block of message.blocks) {
      if (block.type === "image") {
        currentImages.push(block);
      } else {
        if (currentImages.length > 0) {
          result.push({ type: "image_group", blocks: currentImages });
          currentImages = [];
        }
        result.push(block);
      }
    }
    if (currentImages.length > 0) {
      result.push({ type: "image_group", blocks: currentImages });
    }
    return result;
  }, [message.blocks]);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[90%] space-y-2 ${isUser ? "" : ""}`}>
        {renderBlocks.map((block, idx) => {
          if (block.type === "text") {
            if (!block.content) return null;
            return (
              <div
                key={idx}
                className={`relative rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  isUser
                    ? "bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-50 border border-amber-500/20"
                    : "bg-zinc-900 border border-white/5 text-zinc-200"
                }`}
              >
                {isUser ? block.content : <ChatMarkdown content={block.content} />}
              </div>
            );
          }

          if (block.type === "image_group") {
            return (
              <div key={idx} className="flex flex-wrap gap-2">
                {block.blocks.map((imgBlock, imgIdx) => (
                  <div
                    key={imgIdx}
                    className="relative h-24 w-24 overflow-hidden rounded-lg border border-white/10"
                  >
                    <Image
                      src={imgBlock.content}
                      alt={imgBlock.name || "attachment"}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            );
          }

          if (block.type === "tool_call") {
            return <ToolCallCard key={block.id} block={block} />;
          }

          return null;
        })}

        {/* Loading state */}
        {!hasContent && !isUser && (
          <div className="rounded-xl px-3 py-2 bg-white/5">
            <span className="inline-flex items-center gap-1 text-zinc-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                style={{ animationDelay: "0.4s" }}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

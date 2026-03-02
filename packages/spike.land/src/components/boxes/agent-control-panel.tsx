"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BoxMessageRole } from "@prisma/client";
import { BoxStatus } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BoxMessage {
  id: string;
  role: BoxMessageRole;
  content: string;
  createdAt: Date;
}

interface Box {
  id: string;
  name: string;
  description?: string | null;
  status: BoxStatus;
  connectionUrl?: string | null;
  messages?: BoxMessage[];
}

interface AgentControlPanelProps {
  box: Box;
}

/** Shape returned by POST /api/boxes/[id]/messages */
interface SendMessageResponse {
  userMessage: {
    id: string;
    role: BoxMessageRole;
    content: string;
    createdAt: string;
  };
  agentMessage: {
    id: string;
    role: BoxMessageRole;
    content: string;
    createdAt: string;
  };
}

/** Shape returned by GET /api/boxes/[id]/vnc-session */
interface VncSessionResponse {
  url: string;
}

// ---------------------------------------------------------------------------
// Constants (module-level – no closure over component state)
// ---------------------------------------------------------------------------

const VNC_TOKEN_REFRESH_MS = 4 * 60 * 1000; // Refresh token every 4 minutes (expires in 5)

/** Maps BoxStatus to a Tailwind background colour class for the status dot. */
const STATUS_COLOR_MAP: Record<BoxStatus, string> = {
  [BoxStatus.RUNNING]: "bg-green-500",
  [BoxStatus.PAUSED]: "bg-yellow-500",
  [BoxStatus.STOPPING]: "bg-red-500",
  [BoxStatus.STOPPED]: "bg-red-500",
  [BoxStatus.CREATING]: "bg-blue-500",
  [BoxStatus.STARTING]: "bg-blue-500",
  [BoxStatus.ERROR]: "bg-red-600",
  [BoxStatus.TERMINATED]: "bg-gray-600",
};

/** Maps BoxStatus to the shadcn/ui Badge variant. */
const STATUS_BADGE_VARIANT_MAP: Record<
  BoxStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  [BoxStatus.RUNNING]: "default",
  [BoxStatus.PAUSED]: "secondary",
  [BoxStatus.STOPPING]: "destructive",
  [BoxStatus.STOPPED]: "destructive",
  [BoxStatus.TERMINATED]: "destructive",
  [BoxStatus.CREATING]: "secondary",
  [BoxStatus.STARTING]: "secondary",
  [BoxStatus.ERROR]: "destructive",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Agent Control Panel component that provides a split-view interface
 * for chatting with an agent and viewing its live desktop session.
 *
 * Features:
 * - Real-time chat with agent
 * - Auto-scrolling message list
 * - Live VNC/NoVNC session viewer
 * - Agent control actions (pause, restart, debug)
 * - Status indicator with colour-coded badges
 *
 * @param box - The Box object containing agent details, status, and message history
 */
export function AgentControlPanel({ box }: AgentControlPanelProps) {
  const [messages, setMessages] = useState<BoxMessage[]>(box.messages ?? []);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const [vncLoading, setVncLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const vncRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // VNC session management
  // ---------------------------------------------------------------------------

  const fetchVncSession = useCallback(async () => {
    if (box.status !== BoxStatus.RUNNING) return;
    setVncLoading(true);
    try {
      const response = await fetch(`/api/boxes/${box.id}/vnc-session`);
      if (response.ok) {
        const data = (await response.json()) as VncSessionResponse;
        setVncUrl(data.url);
      }
    } catch {
      // Token fetch failure is non-fatal; the iframe will show stale content or nothing
    } finally {
      setVncLoading(false);
    }
  }, [box.id, box.status]);

  // Fetch VNC session token when box is running, and refresh periodically
  useEffect(() => {
    if (box.status === BoxStatus.RUNNING) {
      void fetchVncSession();
      vncRefreshTimer.current = setInterval(() => void fetchVncSession(), VNC_TOKEN_REFRESH_MS);
    } else {
      setVncUrl(null);
    }

    return () => {
      if (vncRefreshTimer.current) {
        clearInterval(vncRefreshTimer.current);
        vncRefreshTimer.current = null;
      }
    };
  }, [box.status, fetchVncSession]);

  // ---------------------------------------------------------------------------
  // Auto-scroll
  // ---------------------------------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------------------------------------------------------------------------
  // Message sending
  // ---------------------------------------------------------------------------

  const handleSendMessage = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setInputValue("");
    setIsTyping(true);

    try {
      const response = await fetch(`/api/boxes/${box.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = (await response.json()) as SendMessageResponse;

      setMessages((prev) => [
        ...prev,
        {
          ...data.userMessage,
          createdAt: new Date(data.userMessage.createdAt),
        },
        {
          ...data.agentMessage,
          createdAt: new Date(data.agentMessage.createdAt),
        },
      ]);
    } catch (error) {
      toast.error("Failed to send message");
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  }, [box.id, inputValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  // ---------------------------------------------------------------------------
  // Agent actions
  // ---------------------------------------------------------------------------

  /**
   * "DEBUG" is a frontend-only placeholder – the server does not yet accept it.
   * Only "STOP" and "RESTART" are dispatched to the API.
   */
  const handleAction = useCallback(
    async (action: "STOP" | "RESTART" | "DEBUG") => {
      if (action === "DEBUG") {
        toast.info("Debug mode is not yet implemented");
        return;
      }

      toast.info(`${action === "STOP" ? "Pausing" : "Restarting"} agent...`);

      try {
        const response = await fetch(`/api/boxes/${box.id}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        if (!response.ok) {
          throw new Error("Action failed");
        }

        toast.success(`Agent ${action === "STOP" ? "paused" : "restarted"} successfully`);
        window.location.reload();
      } catch (error) {
        toast.error("Failed to perform action");
        console.error(error);
      }
    },
    [box.id],
  );

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const statusColorClass = STATUS_COLOR_MAP[box.status] ?? "bg-gray-500";
  const statusBadgeVariant = STATUS_BADGE_VARIANT_MAP[box.status] ?? "outline";

  const vncPlaceholderText = vncLoading
    ? "Connecting to session..."
    : box.status === BoxStatus.RUNNING
      ? "Loading VNC session..."
      : "Session unavailable";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex h-[calc(100dvh-200px)] gap-4">
      {/* ------------------------------------------------------------------ */}
      {/* Chat panel                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-2/5 flex flex-col">
        <Card className="flex flex-col h-full">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold">Chat</h2>
          </div>

          {/*
           * role="log" marks this region as an ARIA live region that
           * announces new messages to screen readers.
           */}
          <div
            role="log"
            aria-label="Conversation with agent"
            aria-live="polite"
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "USER" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 backdrop-blur-xl",
                    message.role === "USER"
                      ? "bg-gradient-primary text-white"
                      : "bg-white/10 text-foreground",
                  )}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}

            {/*
             * The typing indicator is inside the log region so it is announced
             * automatically without a separate aria-live region.
             */}
            {isTyping && (
              <div className="flex justify-start" aria-label="Agent is typing">
                <div className="max-w-[80%] rounded-2xl px-4 py-2 bg-white/10 text-foreground backdrop-blur-xl">
                  <p className="text-sm" aria-hidden>
                    Typing...
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[60px] resize-none"
                aria-label="Message input"
                disabled={isTyping}
                onKeyDown={handleKeyDown}
              />
              <Button
                onClick={() => void handleSendMessage()}
                size="default"
                className="self-end"
                aria-label="Send message"
                disabled={isTyping || !inputValue.trim()}
              >
                Send
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Live session panel                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-3/5 flex flex-col">
        <Card className="flex flex-col h-full">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">Live Session</h2>

              <div className="flex items-center gap-2">
                {/* Decorative dot – hidden from screen readers; Badge carries the label */}
                <div className={cn("w-2 h-2 rounded-full", statusColorClass)} aria-hidden />
                <Badge variant={statusBadgeVariant}>{box.status}</Badge>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleAction("STOP")}
                aria-label="Pause agent"
              >
                Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleAction("RESTART")}
                aria-label="Restart agent"
              >
                Restart
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleAction("DEBUG")}
                aria-label="Debug agent"
              >
                Debug
              </Button>
            </div>
          </div>

          <div className="flex-1 relative bg-black/20">
            {vncUrl && !vncLoading ? (
              <iframe
                src={vncUrl}
                className="w-full h-full absolute inset-0"
                title="Live agent desktop session"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>{vncPlaceholderText}</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

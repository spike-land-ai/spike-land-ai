"use client";

import { Button } from "@/components/ui/button";
import {
  COMEBACK_MESSAGES,
  randomMessage,
  SESSION_COMPLETE_MESSAGES,
  SKIP_MESSAGES,
  STARTING_MESSAGES,
  TASK_COMPLETE_MESSAGES,
} from "@/lib/clean/encouragement";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type MotivationContext =
  | "starting"
  | "task_complete"
  | "skip"
  | "session_complete"
  | "comeback"
  | "idle";

const CONTEXT_MESSAGES: Record<Exclude<MotivationContext, "idle">, string[]> = {
  starting: STARTING_MESSAGES,
  task_complete: TASK_COMPLETE_MESSAGES,
  skip: SKIP_MESSAGES,
  session_complete: SESSION_COMPLETE_MESSAGES,
  comeback: COMEBACK_MESSAGES,
};

const CONTEXT_STYLES: Record<
  Exclude<MotivationContext, "idle">,
  { bg: string; border: string; icon: string; dot: string; }
> = {
  starting: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  task_complete: {
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    icon: "text-green-400",
    dot: "bg-green-400",
  },
  skip: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: "text-amber-400",
    dot: "bg-amber-400",
  },
  session_complete: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    icon: "text-purple-400",
    dot: "bg-purple-400",
  },
  comeback: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: "text-blue-400",
    dot: "bg-blue-400",
  },
};

interface MotivationBannerProps {
  context: MotivationContext;
  dismissable?: boolean;
  autoDismissMs?: number;
  className?: string;
}

export function MotivationBanner({
  context,
  dismissable = true,
  autoDismissMs,
  className,
}: MotivationBannerProps) {
  const [visible, setVisible] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refreshMessage = useCallback(() => {
    if (context === "idle") {
      setMessage(null);
      return;
    }
    const messages = CONTEXT_MESSAGES[context];
    setMessage(randomMessage(messages));
    setVisible(true);
  }, [context]);

  useEffect(() => {
    refreshMessage();
  }, [refreshMessage]);

  useEffect(() => {
    if (!autoDismissMs || context === "idle") return;
    const timer = setTimeout(() => setVisible(false), autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, context, message]);

  if (context === "idle" || !message || !visible) return null;

  const styles = CONTEXT_STYLES[context];

  return (
    <div
      className={`rounded-2xl border p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500 ${styles.bg} ${styles.border} ${
        className ?? ""
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`h-2 w-2 rounded-full shrink-0 animate-pulse ${styles.dot}`}
      />
      <p className={`flex-1 text-sm font-medium ${styles.icon}`}>{message}</p>
      {dismissable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
          onClick={() => setVisible(false)}
          aria-label="Dismiss message"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

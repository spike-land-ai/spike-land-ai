"use client";

import { Loader2, MessageCircle } from "lucide-react";
import React, { useEffect, useState } from "react";

interface SpikeChatEmbedProps {
  channelSlug: string;
  workspaceSlug: string;
  guestAccess?: boolean;
  height?: number | string;
}

export function SpikeChatEmbed({
  channelSlug,
  workspaceSlug,
  guestAccess = false,
  height = 500,
}: SpikeChatEmbedProps) {
  const isLocal = typeof window !== "undefined" && window.location.hostname.includes("localhost");
  const configuredBaseUrl = import.meta.env.VITE_CHAT_BASE_URL?.trim() ?? "";
  const baseUrl = isLocal ? "http://localhost:8787" : configuredBaseUrl;
  const embedUrl = `${baseUrl}/embed/${workspaceSlug}/${channelSlug}?guest=${guestAccess}`;
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
      className="relative my-12 w-full overflow-hidden rounded-[2rem] border-2 border-primary/10 bg-background/50 shadow-sm backdrop-blur"
      style={{ height }}
    >
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-primary z-10 backdrop-blur-sm">
          <Loader2 className="mb-4 h-8 w-8 animate-spin" />
          <p className="text-sm font-medium tracking-wider uppercase">Loading Universal Interface...</p>
        </div>
      )}
      {status === "unavailable" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-muted-foreground z-10 backdrop-blur-sm gap-4">
          <MessageCircle className="h-10 w-10 text-primary/40" />
          <p className="text-lg font-black tracking-tight text-foreground">spike-chat is coming soon</p>
          <p className="text-sm font-medium text-muted-foreground/70 max-w-md text-center leading-relaxed">
            The live chat embed for <span className="font-bold text-primary">#{channelSlug}</span> isn't deployed yet.
            Once it's live, anyone will be able to join the conversation right here.
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

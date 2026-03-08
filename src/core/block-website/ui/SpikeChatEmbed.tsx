"use client";

import { Loader2 } from "lucide-react";
import React, { useState } from "react";

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
  const [isLoaded, setIsLoaded] = useState(false);

  // Fallback to local during dev, otherwise production chat.spike.land
  const isLocal = typeof window !== "undefined" && window.location.hostname.includes("localhost");
  const baseUrl = isLocal ? "http://localhost:8787" : "https://chat.spike.land";
  
  const embedUrl = `${baseUrl}/embed/${workspaceSlug}/${channelSlug}?guest=${guestAccess}`;

  return (
    <div 
      className="relative my-12 w-full overflow-hidden rounded-[2rem] border-2 border-primary/10 bg-background/50 shadow-sm backdrop-blur"
      style={{ height }}
    >
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 text-primary z-10 backdrop-blur-sm">
          <Loader2 className="mb-4 h-8 w-8 animate-spin" />
          <p className="text-sm font-medium tracking-wider uppercase">Loading Universal Interface...</p>
        </div>
      )}
      <iframe
        src={embedUrl}
        title={`Spike Chat - ${channelSlug}`}
        className="h-full w-full border-0"
        onLoad={() => setIsLoaded(true)}
        allow="fullscreen; clipboard-read; clipboard-write"
      />
    </div>
  );
}

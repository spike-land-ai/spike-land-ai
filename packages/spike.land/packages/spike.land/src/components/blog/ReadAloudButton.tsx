"use client";

import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { cn } from "@/lib/utils";
import { Loader2, Pause, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MIN_TEXT_LENGTH = 20;

interface ReadAloudParagraphProps {
  children: React.ReactNode;
}

export function ReadAloudParagraph({ children }: ReadAloudParagraphProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { state, play, stop } = useTextToSpeech();
  const [hasEnoughText, setHasEnoughText] = useState(false);

  useEffect(() => {
    const textContent = ref.current?.textContent || "";
    setHasEnoughText(textContent.trim().length >= MIN_TEXT_LENGTH);
  }, [children]);

  const handleClick = useCallback(() => {
    if (state === "playing") {
      stop();
      return;
    }

    const textContent = ref.current?.textContent || "";
    if (textContent.trim().length >= MIN_TEXT_LENGTH) {
      play(textContent.trim());
    }
  }, [state, play, stop]);

  // Reset error state after a brief display
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (state === "error") {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 2000);
      return () => clearTimeout(timer);
    }
    setShowError(false);
    return undefined;
  }, [state]);

  const icon = state === "loading"
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : state === "playing"
    ? <Pause className="h-4 w-4" />
    : showError
    ? <VolumeX className="h-4 w-4 text-destructive" />
    : <Volume2 className="h-4 w-4" />;

  const tooltip = state === "playing"
    ? "Stop reading"
    : state === "loading"
    ? "Generating audio..."
    : "Listen to this paragraph";

  return (
    <div ref={ref} className="group relative">
      {hasEnoughText && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleClick}
                disabled={state === "loading"}
                className={cn(
                  "absolute -left-10 top-1 p-1 rounded-md transition-all",
                  "opacity-40 md:opacity-0 md:group-hover:opacity-100",
                  "hover:bg-muted focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "text-muted-foreground hover:text-foreground",
                  state === "playing"
                    && "opacity-100 md:opacity-100 text-primary",
                )}
                aria-label={tooltip}
              >
                {icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {children}
    </div>
  );
}

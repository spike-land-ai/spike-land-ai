"use client";

import { cn } from "@/lib/utils";
import { Headphones, Loader2, Pause, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ArticleReaderState = "idle" | "loading" | "playing" | "paused";

// Client-side URL cache
const urlCache = new Map<string, string>();

async function fetchTTSUrl(text: string): Promise<string> {
  const cached = urlCache.get(text);
  if (cached) return cached;

  const response = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  let url: string;

  if (contentType?.includes("audio/")) {
    const blob = await response.blob();
    url = URL.createObjectURL(blob);
  } else {
    const data = await response.json();
    url = data.url;
  }

  urlCache.set(text, url);
  return url;
}

export function ReadAloudArticle() {
  const [state, setState] = useState<ArticleReaderState>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalParagraphs, setTotalParagraphs] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const paragraphsRef = useRef<string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const collectParagraphs = useCallback((): string[] => {
    const articleEl = document.querySelector("[data-article-content]");
    if (!articleEl) return [];

    const paragraphs = Array.from(articleEl.querySelectorAll("p"))
      .map(p => p.textContent?.trim() || "")
      .filter(text => text.length >= 20);

    return paragraphs;
  }, []);

  const playParagraph = useCallback(async (index: number, texts: string[]) => {
    if (!mountedRef.current || index >= texts.length) {
      if (mountedRef.current) {
        setState("idle");
        setCurrentIndex(0);
      }
      return;
    }

    if (mountedRef.current) {
      setState("loading");
      setCurrentIndex(index);
    }

    try {
      // Pre-fetch next paragraph while current one loads
      if (index + 1 < texts.length) {
        fetchTTSUrl(texts[index + 1]!).catch(() => {
          // Silently ignore prefetch failures
        });
      }

      const url = await fetchTTSUrl(texts[index]!);
      if (!mountedRef.current) return;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener("ended", () => {
        audioRef.current = null;
        if (mountedRef.current) {
          playParagraph(index + 1, texts);
        }
      });

      audio.addEventListener("error", () => {
        audioRef.current = null;
        if (mountedRef.current) {
          // Skip failed paragraph, try next
          playParagraph(index + 1, texts);
        }
      });

      if (!mountedRef.current) return;
      setState("playing");
      await audio.play();
    } catch {
      if (mountedRef.current) {
        // Skip failed paragraph
        playParagraph(index + 1, texts);
      }
    }
  }, []);

  const handlePlay = useCallback(() => {
    if (state === "playing" || state === "loading") {
      // Pause
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setState("paused");
      return;
    }

    if (state === "paused" && audioRef.current) {
      // Resume
      setState("playing");
      audioRef.current.play();
      return;
    }

    // Start fresh
    const texts = collectParagraphs();
    if (texts.length === 0) return;

    paragraphsRef.current = texts;
    setTotalParagraphs(texts.length);
    playParagraph(0, texts);
  }, [state, collectParagraphs, playParagraph]);

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState("idle");
    setCurrentIndex(0);
  }, []);

  const isActive = state !== "idle";
  const progress = totalParagraphs > 0
    ? ((currentIndex + 1) / totalParagraphs) * 100
    : 0;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handlePlay}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all",
          "border border-border hover:border-primary/50",
          "text-muted-foreground hover:text-foreground",
          isActive && "border-primary/50 text-primary",
        )}
        aria-label={state === "playing"
          ? "Pause article"
          : state === "paused"
          ? "Resume article"
          : "Listen to article"}
      >
        {state === "loading"
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : state === "playing"
          ? <Pause className="h-4 w-4" />
          : <Headphones className="h-4 w-4" />}
        <span>
          {state === "idle"
            ? "Listen"
            : state === "loading"
            ? "Loading..."
            : state === "paused"
            ? "Paused"
            : `${currentIndex + 1} / ${totalParagraphs}`}
        </span>
      </button>

      {isActive && (
        <>
          <button
            type="button"
            onClick={handleStop}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Stop reading"
          >
            <Square className="h-3.5 w-3.5" />
          </button>

          {/* Progress bar */}
          <div className="flex-1 max-w-32 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

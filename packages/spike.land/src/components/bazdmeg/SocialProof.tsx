"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

/**
 * Live counter showing how many developers have asked about BAZDMEG.
 */
export function SocialProof() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/bazdmeg/chat")
      .then((res) => res.json())
      .then((data: { totalQuestions?: number }) => {
        if (typeof data.totalQuestions === "number") {
          setCount(data.totalQuestions);
        }
      })
      .catch(() => {
        // Non-critical, fail silently
      });
  }, []);

  if (count === null || count === 0) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
      <MessageCircle className="h-4 w-4" />
      <span>
        <strong>{count}</strong> developer{count !== 1 ? "s" : ""} asked about BAZDMEG
      </span>
    </div>
  );
}

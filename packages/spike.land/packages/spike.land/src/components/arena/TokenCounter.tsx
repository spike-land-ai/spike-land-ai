"use client";

interface TokenCounterProps {
  text: string;
}

/**
 * Real-time token estimation using ~4 chars per token heuristic.
 */
export function TokenCounter({ text }: TokenCounterProps) {
  const estimatedTokens = Math.ceil(text.length / 4);

  return (
    <div className="text-xs text-zinc-500">
      ~{estimatedTokens.toLocaleString()} tokens
    </div>
  );
}

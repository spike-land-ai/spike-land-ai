"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { TokenCounter } from "./TokenCounter";
import { LiveStream } from "./LiveStream";
import Link from "next/link";

interface PromptSubmitFormProps {
  challengeId: string;
}

export function PromptSubmitForm({ challengeId }: PromptSubmitFormProps) {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim() || prompt.length < 10) {
      setError("Prompt must be at least 10 characters");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/connect/challenges/${challengeId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          systemPrompt: showSystemPrompt && systemPrompt.trim()
            ? systemPrompt.trim()
            : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Submission failed");
      }

      const data = await res.json();
      setSubmissionId(data.submissionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Link
        href={`/connect/${challengeId}`}
        className="text-sm text-zinc-500 hover:text-zinc-400 mb-4 inline-block"
      >
        &larr; Back to challenge
      </Link>

      <h1 className="text-2xl font-bold text-zinc-100 mb-6">
        Submit a Prompt
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Prompt Editor */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="arena-prompt"
                className="text-sm font-medium text-zinc-300"
              >
                Your Prompt
              </label>
              <TokenCounter text={prompt} />
            </div>
            <Textarea
              id="arena-prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the React app you want to generate..."
              className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 min-h-[200px] font-mono text-sm"
              disabled={!!submissionId}
            />
          </div>

          {!submissionId && (
            <button
              type="button"
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className="text-xs text-zinc-500 hover:text-zinc-400"
            >
              {showSystemPrompt ? "Hide" : "Show"} system prompt (optional)
            </button>
          )}

          {showSystemPrompt && !submissionId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="arena-system-prompt"
                  className="text-sm font-medium text-zinc-300"
                >
                  System Prompt (optional)
                </label>
                <TokenCounter text={systemPrompt} />
              </div>
              <Textarea
                id="arena-system-prompt"
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Custom instructions for the AI..."
                className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 min-h-[100px] font-mono text-sm"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {!submissionId && (
            <Button
              onClick={handleSubmit}
              disabled={submitting || prompt.length < 10}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full"
            >
              {submitting ? "Submitting..." : "Submit Prompt"}
            </Button>
          )}
        </div>

        {/* Right: Generation Log + Live Preview */}
        <div>
          {submissionId
            ? (
              <LiveStream
                challengeId={challengeId}
                submissionId={submissionId}
              />
            )
            : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
                <p className="text-zinc-500">
                  Submit your prompt to see live generation progress here.
                </p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

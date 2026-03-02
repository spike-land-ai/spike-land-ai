"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { SubmissionCard } from "./SubmissionCard";
import Link from "next/link";

interface Submission {
  id: string;
  status: string;
  codespaceUrl: string | null;
  transpileSuccess: boolean | null;
  iterations: number;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  reviewScore: number | null;
  eloChange: number | null;
  totalDurationMs: number | null;
  errors: Array<{ error: string; iteration: number; fixed: boolean }>;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
  _count: { reviews: number };
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  status: string;
  closesAt: string | null;
  createdBy: { name: string | null; image: string | null };
  _count: { submissions: number };
  submissions: Submission[];
}

const difficultyColor: Record<string, string> = {
  BEGINNER: "bg-green-500/10 text-green-400 border-green-500/20",
  INTERMEDIATE: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ADVANCED: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  EXPERT: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function ChallengeDetail({ challengeId }: { challengeId: string }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/connect/challenges/${challengeId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setChallenge)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [challengeId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="h-32 bg-zinc-900 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <h1 className="text-2xl text-zinc-100 mb-2">Challenge not found</h1>
        <Link href="/connect" className="text-blue-400 hover:text-blue-300">
          Back to Arena
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href="/connect" className="text-sm text-zinc-500 hover:text-zinc-400 mb-4 inline-block">
        &larr; Back to Arena
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
            {challenge.category}
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs ${difficultyColor[challenge.difficulty] || ""}`}
          >
            {challenge.difficulty.toLowerCase()}
          </Badge>
          <Badge
            variant="outline"
            className={`text-xs ${
              challenge.status === "OPEN"
                ? "text-green-400 border-green-500/20"
                : "text-zinc-400 border-zinc-700"
            }`}
          >
            {challenge.status.toLowerCase()}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-3">{challenge.title}</h1>
        <p className="text-zinc-400 whitespace-pre-wrap">{challenge.description}</p>
        <div className="mt-4 text-sm text-zinc-500">
          Created by {challenge.createdBy.name || "Unknown"} &middot; {challenge._count.submissions}{" "}
          submissions
        </div>
      </div>

      {challenge.status === "OPEN" && (
        <div className="mb-8">
          <Link href={`/connect/${challengeId}/submit`}>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Submit a Prompt</Button>
          </Link>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-zinc-200 mb-4">Submissions</h2>
        {challenge.submissions.length === 0 ? (
          <p className="text-zinc-500">No submissions yet. Be the first!</p>
        ) : (
          <div className="space-y-3">
            {challenge.submissions.map((s) => (
              <SubmissionCard
                key={s.id}
                id={s.id}
                status={s.status}
                codespaceUrl={s.codespaceUrl}
                reviewScore={s.reviewScore}
                eloChange={s.eloChange}
                iterations={s.iterations}
                inputTokens={s.inputTokens}
                outputTokens={s.outputTokens}
                totalDurationMs={s.totalDurationMs}
                userName={s.user.name}
                userImage={s.user.image}
                reviewCount={s._count.reviews}
                errors={s.errors}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

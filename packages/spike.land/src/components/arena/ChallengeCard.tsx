"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface ChallengeCardProps {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  submissionCount: number;
}

const difficultyColor: Record<string, string> = {
  BEGINNER: "bg-green-500/10 text-green-400 border-green-500/20",
  INTERMEDIATE: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  ADVANCED: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  EXPERT: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function ChallengeCard({
  id,
  title,
  description,
  category,
  difficulty,
  submissionCount,
}: ChallengeCardProps) {
  return (
    <Link href={`/connect/${id}`}>
      <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-700">
              {category}
            </Badge>
            <Badge variant="outline" className={`text-xs ${difficultyColor[difficulty] || ""}`}>
              {difficulty.toLowerCase()}
            </Badge>
          </div>
          <CardTitle className="text-lg text-zinc-100">{title}</CardTitle>
          <CardDescription className="text-zinc-400 line-clamp-2">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-zinc-500">
            {submissionCount} submission{submissionCount !== 1 ? "s" : ""}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

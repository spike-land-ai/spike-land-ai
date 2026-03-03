"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Occupation } from "@/lib/career/types";

interface OccupationCardProps {
  occupation: Occupation;
  matchScore?: number;
}

export function OccupationCard(
  { occupation, matchScore }: OccupationCardProps,
) {
  const essentialCount = occupation.skills.filter(s => s.skillType === "essential").length;

  return (
    <Link href={`/career/${encodeURIComponent(occupation.uri)}`}>
      <Card className="bg-zinc-900 border-white/[0.06] hover:border-white/[0.12] transition-colors h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium text-white line-clamp-2">
              {occupation.title}
            </CardTitle>
            {matchScore !== undefined && (
              <Badge
                variant="outline"
                className={matchScore >= 70
                  ? "border-emerald-500/30 text-emerald-400 shrink-0"
                  : matchScore >= 40
                  ? "border-amber-500/30 text-amber-400 shrink-0"
                  : "border-red-500/30 text-red-400 shrink-0"}
              >
                {matchScore}%
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500 line-clamp-3 mb-3">
            {occupation.description}
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{essentialCount} essential skills</span>
            {occupation.iscoGroup && (
              <>
                <span className="text-zinc-700">|</span>
                <span>ISCO {occupation.iscoGroup}</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

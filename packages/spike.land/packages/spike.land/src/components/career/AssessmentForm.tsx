"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkillInput } from "./SkillInput";
import { SkillProficiencySlider } from "./SkillProficiencySlider";
import { MatchBadge } from "./MatchBadge";
import { useCareerStore } from "@/lib/store/career";
import { useCareerAssessment } from "@/hooks/useCareerAssessment";
import { Loader2, Trash2 } from "lucide-react";
import type { MatchResult } from "@/lib/career/types";

export function AssessmentForm() {
  const { userSkills, removeSkill, updateSkillProficiency } = useCareerStore();
  const { assess, results, isAssessing } = useCareerAssessment();
  const [showResults, setShowResults] = useState(false);

  const handleAssess = async () => {
    await assess();
    setShowResults(true);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-white/[0.06]">
        <CardHeader>
          <CardTitle className="text-white">Your Skills</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SkillInput />

          {userSkills.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-4">
              Start typing to search and add skills from the ESCO database.
            </p>
          )}

          {userSkills.map(skill => (
            <div
              key={skill.uri}
              className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-white/[0.04]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {skill.title}
                </p>
              </div>
              <SkillProficiencySlider
                value={skill.proficiency}
                onChange={v => updateSkillProficiency(skill.uri, v)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeSkill(skill.uri)}
                className="text-zinc-500 hover:text-red-400 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {userSkills.length > 0 && (
            <Button
              onClick={handleAssess}
              disabled={isAssessing}
              className="w-full mt-4"
            >
              {isAssessing
                ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                )
                : (
                  `Assess ${userSkills.length} Skills`
                )}
            </Button>
          )}
        </CardContent>
      </Card>

      {showResults && results && results.length > 0 && (
        <Card className="bg-zinc-900 border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-white">Top Career Matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((match: MatchResult) => (
              <a
                key={match.occupation.uri}
                href={`/career/${encodeURIComponent(match.occupation.uri)}`}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-white/[0.04] hover:border-white/[0.12] transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {match.occupation.title}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {match.matchedSkills}/{match.totalRequired} skills matched
                  </p>
                </div>
                <MatchBadge score={match.score} />
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

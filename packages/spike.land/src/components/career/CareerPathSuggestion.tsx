import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Occupation, UserSkill } from "@/lib/career/types";

interface CareerPathSuggestionProps {
  occupation: Occupation;
  userSkills: UserSkill[];
}

export function CareerPathSuggestion({ occupation, userSkills }: CareerPathSuggestionProps) {
  const userSkillUris = new Set(userSkills.map((s) => s.uri));

  const missingEssential = occupation.skills
    .filter((s) => s.skillType === "essential" && !userSkillUris.has(s.uri))
    .sort((a, b) => b.importance - a.importance);

  const missingOptional = occupation.skills
    .filter((s) => s.skillType === "optional" && !userSkillUris.has(s.uri))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5);

  if (missingEssential.length === 0 && missingOptional.length === 0) {
    return (
      <Card className="bg-zinc-900 border-white/[0.06]">
        <CardContent className="p-6 text-center">
          <p className="text-emerald-400 font-medium">
            You have all the key skills for this occupation!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {missingEssential.length > 0 && (
        <Card className="bg-zinc-900 border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-white text-sm">
              Priority: Essential Skills to Develop ({missingEssential.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {missingEssential.map((skill, i) => (
              <div key={skill.uri} className="flex items-center gap-3 p-2 rounded bg-zinc-800/50">
                <span className="text-xs text-zinc-500 w-6">{i + 1}.</span>
                <span className="text-sm text-white flex-1">{skill.title}</span>
                <Badge variant="outline" className="text-xs border-red-500/20 text-red-400">
                  Essential
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {missingOptional.length > 0 && (
        <Card className="bg-zinc-900 border-white/[0.06]">
          <CardHeader>
            <CardTitle className="text-white text-sm">
              Nice to Have: Optional Skills ({missingOptional.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {missingOptional.map((skill, i) => (
              <div key={skill.uri} className="flex items-center gap-3 p-2 rounded bg-zinc-800/50">
                <span className="text-xs text-zinc-500 w-6">{i + 1}.</span>
                <span className="text-sm text-white flex-1">{skill.title}</span>
                <Badge variant="outline" className="text-xs border-zinc-500/20 text-zinc-400">
                  Optional
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

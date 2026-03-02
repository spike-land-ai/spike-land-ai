import type {
  MatchResult,
  Occupation,
  OccupationSkillRequirement,
  SkillGap,
  UserSkill,
} from "../types";

/**
 * Find a matching user skill for a given occupation requirement.
 * First tries exact URI match, then falls back to case-insensitive title match.
 */
function findMatchingUserSkill(
  req: OccupationSkillRequirement,
  userSkillsByUri: Map<string, UserSkill>,
  userSkillsByTitle: Map<string, UserSkill>,
): UserSkill | undefined {
  return userSkillsByUri.get(req.uri) ?? userSkillsByTitle.get(req.title.toLowerCase());
}

function buildUserSkillLookups(userSkills: UserSkill[]): {
  byUri: Map<string, UserSkill>;
  byTitle: Map<string, UserSkill>;
} {
  const byUri = new Map<string, UserSkill>();
  const byTitle = new Map<string, UserSkill>();
  for (const s of userSkills) {
    if (s.uri) {
      byUri.set(s.uri, s);
    }
    byTitle.set(s.title.toLowerCase(), s);
  }
  return { byUri, byTitle };
}

function getGapPriority(gap: number): "high" | "medium" | "low" {
  if (gap >= 3) return "high";
  if (gap >= 2) return "medium";
  return "low";
}

function computeSkillGaps(userSkills: UserSkill[], occupation: Occupation): SkillGap[] {
  const { byUri, byTitle } = buildUserSkillLookups(userSkills);

  return occupation.skills.map((req) => {
    const userSkill = findMatchingUserSkill(req, byUri, byTitle);
    const userProficiency = userSkill?.proficiency ?? 0;
    // Normalize required level: essential=5, optional=3
    const requiredLevel = req.skillType === "essential" ? 5 : 3;
    const gap = Math.max(0, requiredLevel - userProficiency);

    return {
      skill: req,
      userProficiency,
      requiredLevel,
      gap,
      priority: getGapPriority(gap),
    };
  });
}

function computeScore(
  userSkills: UserSkill[],
  occupation: Occupation,
  gaps: SkillGap[],
): { score: number; matchedSkills: number } {
  if (occupation.skills.length === 0) {
    return { score: 0, matchedSkills: 0 };
  }

  const { byUri, byTitle } = buildUserSkillLookups(userSkills);

  // Weighted Jaccard: sum of importance for matched skills / sum of all importance
  let matchedWeight = 0;
  let totalWeight = 0;
  let matchedCount = 0;

  for (const req of occupation.skills) {
    totalWeight += req.importance;
    if (findMatchingUserSkill(req, byUri, byTitle)) {
      matchedWeight += req.importance;
      matchedCount++;
    }
  }

  const weightedJaccard = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  // Normalized gap: average gap across all skills, normalized to 0-1
  // Use actual max gap per skill based on type (essential=5, optional=3)
  const totalGap = gaps.reduce((sum, g) => sum + g.gap, 0);
  const maxPossibleGap = gaps.reduce((sum, g) => sum + g.requiredLevel, 0);
  const normalizedGap = maxPossibleGap > 0 ? totalGap / maxPossibleGap : 0;

  // Combined score: 60% weighted jaccard + 40% (1 - normalized gap)
  const score = Math.round((0.6 * weightedJaccard + 0.4 * (1 - normalizedGap)) * 100);

  return {
    score: Math.max(0, Math.min(100, score)),
    matchedSkills: matchedCount,
  };
}

export function compareSkills(userSkills: UserSkill[], occupation: Occupation): MatchResult {
  const gaps = computeSkillGaps(userSkills, occupation);
  const { score, matchedSkills } = computeScore(userSkills, occupation, gaps);

  return {
    occupation,
    score,
    matchedSkills,
    totalRequired: occupation.skills.length,
    gaps,
  };
}

export function assessSkills(userSkills: UserSkill[], occupations: Occupation[]): MatchResult[] {
  return occupations
    .map((occupation) => compareSkills(userSkills, occupation))
    .sort((a, b) => b.score - a.score);
}

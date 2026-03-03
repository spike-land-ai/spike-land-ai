import { extractKeywords, matchesAny } from "./keyword-utils";
import { SKILL_DEFINITIONS, type SkillDefinition } from "./skill-definitions";

export function getMatchedSkills(query: string): SkillDefinition[] {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const seen = new Set<string>();
  const matched: SkillDefinition[] = [];

  for (const skill of SKILL_DEFINITIONS) {
    if (!seen.has(skill.id) && matchesAny(keywords, skill.triggers)) {
      seen.add(skill.id);
      matched.push(skill);
    }
  }

  return matched;
}

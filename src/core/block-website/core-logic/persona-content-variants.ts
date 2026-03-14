/**
 * Persona-to-content-variant mapping for blog article personalization.
 *
 * Maps the 16 onboarding personas into 4 content groups,
 * each with distinct copy, quiz difficulty, and category emphasis.
 */

export type PersonaGroup = "technical" | "founder" | "leader" | "creative";

export interface ContentVariant {
  group: PersonaGroup;
  supportCopy: string;
  quizDifficulty: "standard" | "advanced";
  /** Categories to expand by default in ToolsByCategoryGrid */
  expandedCategories: string[];
}

const PERSONA_GROUP_MAP: Record<string, PersonaGroup> = {
  "ai-indie": "technical",
  "classic-indie": "technical",
  "agency-dev": "technical",
  "in-house-dev": "technical",
  "ml-engineer": "technical",
  "ai-hobbyist": "technical",
  "enterprise-devops": "technical",
  "startup-devops": "technical",
  "technical-founder": "founder",
  "nontechnical-founder": "founder",
  "growth-leader": "leader",
  "ops-leader": "leader",
  "content-creator": "creative",
  "hobbyist-creator": "creative",
  "social-gamer": "creative",
  "solo-explorer": "creative",
};

const GROUP_VARIANTS: Record<PersonaGroup, ContentVariant> = {
  technical: {
    group: "technical",
    supportCopy:
      "Support Gian Pierre and Radix \u2014 two developers shipping 80+ MCP tools without VC funding. Every tool you used today was built between midnight deploys.",
    quizDifficulty: "advanced",
    expandedCategories: ["core", "mcp-tools", "edge-api"],
  },
  founder: {
    group: "founder",
    supportCopy:
      "Support independent toolmakers Gian Pierre and Radix \u2014 building the infrastructure you bet your business on.",
    quizDifficulty: "standard",
    expandedCategories: ["edge-api", "frontend", "cli"],
  },
  leader: {
    group: "leader",
    supportCopy:
      "Support Gian Pierre and Radix\u2019s mission \u2014 democratizing the tools your team needs.",
    quizDifficulty: "standard",
    expandedCategories: ["edge-api", "utilities", "mcp-tools"],
  },
  creative: {
    group: "creative",
    supportCopy:
      "Support the passion behind the platform \u2014 Gian Pierre and Radix build this because they love building.",
    quizDifficulty: "standard",
    expandedCategories: ["media", "frontend", "utilities"],
  },
};

export function getPersonaGroup(personaSlug: string): PersonaGroup {
  return PERSONA_GROUP_MAP[personaSlug] ?? "creative";
}

export function getContentVariant(personaSlug: string): ContentVariant {
  const group = getPersonaGroup(personaSlug);
  return GROUP_VARIANTS[group];
}

export function getPersonaSlug(): string {
  if (typeof window === "undefined") return "solo-explorer";
  try {
    // Check cookie first, then localStorage (multiple keys for compat)
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("spike-persona="));
    if (cookie) return cookie.split("=")[1] ?? "solo-explorer";

    return (
      localStorage.getItem("spike_persona_slug") ??
      localStorage.getItem("spike_persona") ??
      "solo-explorer"
    );
  } catch {
    return "solo-explorer";
  }
}

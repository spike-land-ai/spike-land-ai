/**
 * Onboarding wizard — 4 yes/no questions to determine user persona.
 */

import { createInterface } from "node:readline";

const ONBOARDING_QUESTIONS = [
  "Do you write code regularly?",
  "Are you building a product or business?",
  "Do you work with a team?",
  "Are you interested in AI/automation?",
];

const PERSONAS: Record<number, { slug: string; name: string; description: string }> = {
  0: {
    slug: "curious-explorer",
    name: "Curious Explorer",
    description: "You're here to discover what's possible",
  },
  1: {
    slug: "ai-enthusiast",
    name: "AI Enthusiast",
    description: "You want to leverage AI in your workflow",
  },
  2: {
    slug: "team-collaborator",
    name: "Team Collaborator",
    description: "You need tools for team productivity",
  },
  3: {
    slug: "team-automator",
    name: "Team Automator",
    description: "You want AI-powered team workflows",
  },
  4: {
    slug: "solo-builder",
    name: "Solo Builder",
    description: "You're building something on your own",
  },
  5: {
    slug: "indie-shipper",
    name: "Indie Shipper",
    description: "You ship products fast with AI help",
  },
  6: {
    slug: "product-lead",
    name: "Product Lead",
    description: "You lead product development with a team",
  },
  7: {
    slug: "tech-lead",
    name: "Tech Lead",
    description: "You lead a technical team with AI integration",
  },
  8: {
    slug: "hobbyist-coder",
    name: "Hobbyist Coder",
    description: "You code for fun and learning",
  },
  9: {
    slug: "automation-tinker",
    name: "Automation Tinkerer",
    description: "You love automating everything",
  },
  10: {
    slug: "dev-contributor",
    name: "Dev Contributor",
    description: "You contribute to team codebases",
  },
  11: {
    slug: "devops-automator",
    name: "DevOps Automator",
    description: "You automate development operations",
  },
  12: {
    slug: "solo-maker",
    name: "Solo Maker",
    description: "You build and ship solo projects",
  },
  13: {
    slug: "ai-maker",
    name: "AI Maker",
    description: "You build AI-powered products",
  },
  14: {
    slug: "engineering-manager",
    name: "Engineering Manager",
    description: "You manage engineering teams and products",
  },
  15: {
    slug: "ai-engineering-lead",
    name: "AI Engineering Lead",
    description: "You lead AI-integrated engineering teams",
  },
};

export function getPersonaId(answers: boolean[]): number {
  return answers.reduce((id, answer, i) => id + (answer ? 8 >> i : 0), 0);
}

export interface OnboardingResult {
  personaId: number;
  personaSlug: string;
  personaName: string;
  answers: boolean[];
  completedAt: string;
}

async function askQuestion(
  rl: ReturnType<typeof createInterface>,
  question: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}

export async function runOnboardingWizard(): Promise<OnboardingResult> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  try {
    console.error("\nLet's personalize your experience:\n");

    const answers: boolean[] = [];
    for (const question of ONBOARDING_QUESTIONS) {
      const answer = await askQuestion(rl, question);
      answers.push(answer);
    }

    const personaId = getPersonaId(answers);
    const persona = PERSONAS[personaId];

    return {
      personaId,
      personaSlug: persona?.slug ?? String(personaId),
      personaName: persona?.name ?? String(personaId),
      answers,
      completedAt: new Date().toISOString(),
    };
  } finally {
    rl.close();
  }
}

export async function submitOnboarding(
  result: OnboardingResult,
  baseUrl: string,
  token: string,
): Promise<void> {
  await fetch(`${baseUrl}/api/onboarding`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(result),
  });
}

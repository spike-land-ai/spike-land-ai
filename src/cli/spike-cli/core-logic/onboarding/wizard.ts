/**
 * Onboarding wizard — branching decision tree to determine user persona.
 *
 * Uses the canonical beUniq decision tree from persona-data.ts so that
 * the CLI produces the same persona as the web onboarding flow.
 */

import { createInterface } from "node:readline";

// ── Decision Tree (copied from spike-land persona-data.ts) ──────────────────

export interface OnboardingQuestion {
  id: string;
  text: string;
  yesLabel: string;
  noLabel: string;
  /** Next question id, or persona id (number) if leaf */
  yesNext: string | number;
  noNext: string | number;
}

export interface OnboardingPersona {
  id: number;
  slug: string;
  name: string;
  description: string;
}

export const ONBOARDING_TREE: OnboardingQuestion[] = [
  // Layer 1
  {
    id: "q1",
    text: "Do you write code?",
    yesLabel: "Yes, I code",
    noLabel: "No, I don't",
    yesNext: "q2-tech",
    noNext: "q2-nontech",
  },
  // Layer 2 — technical branch
  {
    id: "q2-tech",
    text: "What do you mainly build?",
    yesLabel: "Apps & products",
    noLabel: "Tools, automation & infra",
    yesNext: "q3-product",
    noNext: "q3-platform",
  },
  // Layer 2 — non-technical branch
  {
    id: "q2-nontech",
    text: "What's your primary goal?",
    yesLabel: "Grow a business",
    noLabel: "Create, learn, or have fun",
    yesNext: "q3-business",
    noNext: "q3-personal",
  },
  // Layer 3 — product builder
  {
    id: "q3-product",
    text: "Who are you building for?",
    yesLabel: "Myself / my own startup",
    noLabel: "A client or employer",
    yesNext: "q4-indie",
    noNext: "q4-agency",
  },
  // Layer 3 — platform engineer
  {
    id: "q3-platform",
    text: "What's your focus area?",
    yesLabel: "AI & machine learning",
    noLabel: "DevOps, testing & workflows",
    yesNext: "q4-ai",
    noNext: "q4-devops",
  },
  // Layer 3 — business
  {
    id: "q3-business",
    text: "What's your team size?",
    yesLabel: "Just me",
    noLabel: "I have a team",
    yesNext: "q4-solofound",
    noNext: "q4-teamlead",
  },
  // Layer 3 — personal
  {
    id: "q3-personal",
    text: "What interests you most?",
    yesLabel: "Creating content & art",
    noLabel: "Games, learning & exploration",
    yesNext: "q4-creative",
    noNext: "q4-casual",
  },
  // Layer 4 — leaves
  {
    id: "q4-indie",
    text: "Are you using AI in your product?",
    yesLabel: "Yes, AI-powered",
    noLabel: "No, traditional stack",
    yesNext: 1,
    noNext: 2,
  },
  {
    id: "q4-agency",
    text: "Do you work with multiple clients?",
    yesLabel: "Yes, multiple clients",
    noLabel: "No, one employer",
    yesNext: 3,
    noNext: 4,
  },
  {
    id: "q4-ai",
    text: "Do you deploy models to production?",
    yesLabel: "Yes, production ML",
    noLabel: "No, exploring & learning",
    yesNext: 5,
    noNext: 6,
  },
  {
    id: "q4-devops",
    text: "Is your team more than 10 people?",
    yesLabel: "Yes, large team",
    noLabel: "No, small team",
    yesNext: 7,
    noNext: 8,
  },
  {
    id: "q4-solofound",
    text: "Are you technical?",
    yesLabel: "Yes",
    noLabel: "Not really",
    yesNext: 9,
    noNext: 10,
  },
  {
    id: "q4-teamlead",
    text: "Is your focus growth or efficiency?",
    yesLabel: "Growth",
    noLabel: "Efficiency",
    yesNext: 11,
    noNext: 12,
  },
  {
    id: "q4-creative",
    text: "Do you create for an audience?",
    yesLabel: "Yes, I have an audience",
    noLabel: "No, just for myself",
    yesNext: 13,
    noNext: 14,
  },
  {
    id: "q4-casual",
    text: "Do you prefer playing with others?",
    yesLabel: "Yes, multiplayer",
    noLabel: "No, solo is fine",
    yesNext: 15,
    noNext: 16,
  },
];

export const PERSONAS: OnboardingPersona[] = [
  {
    id: 1,
    slug: "ai-indie",
    name: "AI Indie",
    description: "Solo developer building AI-powered products",
  },
  {
    id: 2,
    slug: "classic-indie",
    name: "Classic Indie",
    description: "Solo developer building traditional apps",
  },
  {
    id: 3,
    slug: "agency-dev",
    name: "Agency Dev",
    description: "Freelancer or agency developer building for clients",
  },
  {
    id: 4,
    slug: "in-house-dev",
    name: "In-house Dev",
    description: "Developer employed at a company",
  },
  {
    id: 5,
    slug: "ml-engineer",
    name: "ML Engineer",
    description: "ML/AI engineer deploying models to production",
  },
  {
    id: 6,
    slug: "ai-hobbyist",
    name: "AI Hobbyist",
    description: "Developer exploring AI for fun and learning",
  },
  {
    id: 7,
    slug: "enterprise-devops",
    name: "Enterprise DevOps",
    description: "DevOps engineer in a large organization",
  },
  {
    id: 8,
    slug: "startup-devops",
    name: "Startup DevOps",
    description: "DevOps engineer in a small team or startup",
  },
  {
    id: 9,
    slug: "technical-founder",
    name: "Technical Founder",
    description: "Tech-savvy solo founder building a business",
  },
  {
    id: 10,
    slug: "nontechnical-founder",
    name: "Non-technical Founder",
    description: "Non-tech solo founder who needs guided, no-code tools",
  },
  {
    id: 11,
    slug: "growth-leader",
    name: "Growth Leader",
    description: "Business leader focused on scaling teams and revenue",
  },
  {
    id: 12,
    slug: "ops-leader",
    name: "Ops Leader",
    description: "Business leader optimizing team operations",
  },
  {
    id: 13,
    slug: "content-creator",
    name: "Content Creator",
    description: "Creator with an audience producing content",
  },
  {
    id: 14,
    slug: "hobbyist-creator",
    name: "Hobbyist Creator",
    description: "Person creating art, music, or content for personal enjoyment",
  },
  {
    id: 15,
    slug: "social-gamer",
    name: "Social Gamer",
    description: "Person who enjoys multiplayer and social games",
  },
  {
    id: 16,
    slug: "solo-explorer",
    name: "Solo Explorer",
    description: "Casual user exploring the platform for personal use",
  },
];

// ── Tree Walker ──────────────────────────────────────────────────────────────

const questionMap = new Map(ONBOARDING_TREE.map((q) => [q.id, q]));

/**
 * Walk the decision tree with 4 boolean answers and return the matching persona.
 * Returns null if answers don't lead to a valid persona.
 */
export function getPersonaFromAnswers(answers: boolean[]): OnboardingPersona | null {
  if (answers.length !== 4) return null;

  let currentId: string | number = "q1";

  for (const answer of answers) {
    if (typeof currentId === "number") break;

    const question = questionMap.get(currentId);
    if (!question) return null;

    currentId = answer ? question.yesNext : question.noNext;
  }

  if (typeof currentId !== "number") return null;

  return PERSONAS.find((p) => p.id === currentId) ?? null;
}

/**
 * Get the sequence of questions a user will see based on their answers so far.
 */
export function getQuestionSequence(answers: boolean[]): OnboardingQuestion[] {
  const sequence: OnboardingQuestion[] = [];
  let currentId: string | number = "q1";

  for (let i = 0; i <= answers.length && i < 4; i++) {
    if (typeof currentId === "number") break;

    const question = questionMap.get(currentId);
    if (!question) break;

    sequence.push(question);

    if (i < answers.length) {
      currentId = answers[i] ? question.yesNext : question.noNext;
    }
  }

  return sequence;
}

// ── Interactive Wizard ───────────────────────────────────────────────────────

export interface OnboardingResult {
  personaId: number;
  personaSlug: string;
  personaName: string;
  answers: boolean[];
  completedAt: string;
}

async function askQuestion(
  rl: ReturnType<typeof createInterface>,
  question: OnboardingQuestion,
): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(
      `${question.text}\n  [y] ${question.yesLabel}  /  [n] ${question.noLabel}: `,
      (answer) => {
        resolve(answer.toLowerCase().startsWith("y"));
      },
    );
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
    let currentId: string | number = "q1";

    for (let step = 0; step < 4; step++) {
      if (typeof currentId === "number") break;

      const question = questionMap.get(currentId);
      if (!question) break;

      const answer = await askQuestion(rl, question);
      answers.push(answer);

      currentId = answer ? question.yesNext : question.noNext;
    }

    const persona =
      typeof currentId === "number" ? (PERSONAS.find((p) => p.id === currentId) ?? null) : null;

    return {
      personaId: persona?.id ?? 0,
      personaSlug: persona?.slug ?? "unknown",
      personaName: persona?.name ?? "Unknown",
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

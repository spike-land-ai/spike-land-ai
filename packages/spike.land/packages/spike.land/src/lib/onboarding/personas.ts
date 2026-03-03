/**
 * Onboarding Decision Tree & Persona Definitions
 *
 * 4 binary questions => 16 personas.
 * Each persona maps to recommended store app slugs and personalized copy.
 *
 * Segments are designed to be:
 * - Findable (targetable on LinkedIn, Google, Reddit, communities)
 * - Distinct (different messaging, value prop, pricing sensitivity)
 * - Stable (based on identity, not journey stage)
 * - Investable (clear market story for investors)
 */

export interface OnboardingPersona {
  id: number;
  slug: string;
  name: string;
  description: string;
  heroText: string;
  cta: { label: string; href: string; };
  recommendedAppSlugs: string[];
  defaultTheme: "light" | "dark" | "theme-soft-light" | "theme-deep-dark";
}

export interface OnboardingQuestion {
  id: string;
  text: string;
  yesLabel: string;
  noLabel: string;
  /** Next question id, or persona id (number) if leaf */
  yesNext: string | number;
  noNext: string | number;
}

// ── Decision Tree ──────────────────────────────────────────────────────────

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
    yesNext: 1, // AI Indie
    noNext: 2, // Classic Indie
  },
  {
    id: "q4-agency",
    text: "Do you work with multiple clients?",
    yesLabel: "Yes, multiple clients",
    noLabel: "No, one employer",
    yesNext: 3, // Agency Dev
    noNext: 4, // In-house Dev
  },
  {
    id: "q4-ai",
    text: "Do you deploy models to production?",
    yesLabel: "Yes, production ML",
    noLabel: "No, exploring & learning",
    yesNext: 5, // ML Engineer
    noNext: 6, // AI Hobbyist
  },
  {
    id: "q4-devops",
    text: "Is your team more than 10 people?",
    yesLabel: "Yes, large team",
    noLabel: "No, small team",
    yesNext: 7, // Enterprise DevOps
    noNext: 8, // Startup DevOps
  },
  {
    id: "q4-solofound",
    text: "Are you technical?",
    yesLabel: "Yes",
    noLabel: "Not really",
    yesNext: 9, // Technical Founder
    noNext: 10, // Non-technical Founder
  },
  {
    id: "q4-teamlead",
    text: "Is your focus growth or efficiency?",
    yesLabel: "Growth",
    noLabel: "Efficiency",
    yesNext: 11, // Growth Leader
    noNext: 12, // Ops Leader
  },
  {
    id: "q4-creative",
    text: "Do you create for an audience?",
    yesLabel: "Yes, I have an audience",
    noLabel: "No, just for myself",
    yesNext: 13, // Content Creator
    noNext: 14, // Hobbyist Creator
  },
  {
    id: "q4-casual",
    text: "Do you prefer playing with others?",
    yesLabel: "Yes, multiplayer",
    noLabel: "No, solo is fine",
    yesNext: 15, // Social Gamer
    noNext: 16, // Solo Explorer
  },
];

// ── Personas ───────────────────────────────────────────────────────────────

export const PERSONAS: OnboardingPersona[] = [
  {
    id: 1,
    slug: "ai-indie",
    name: "AI Indie",
    description: "Solo developer building AI-powered products",
    heroText: "Ship your AI product faster with tools built for indie builders.",
    cta: { label: "Start Building", href: "/store" },
    recommendedAppSlugs: [
      "ai-orchestrator",
      "codespace",
      "app-creator",
      "ops-dashboard",
    ],
    defaultTheme: "theme-deep-dark",
  },
  {
    id: 2,
    slug: "classic-indie",
    name: "Classic Indie",
    description: "Solo developer building traditional apps",
    heroText: "From idea to launch — everything you need to ship your product.",
    cta: { label: "Ship It", href: "/store" },
    recommendedAppSlugs: [
      "codespace",
      "app-creator",
      "ops-dashboard",
      "qa-studio",
    ],
    defaultTheme: "dark",
  },
  {
    id: 3,
    slug: "agency-dev",
    name: "Agency Dev",
    description: "Freelancer or agency developer building for clients",
    heroText: "Deliver client projects faster with ready-made components and tools.",
    cta: { label: "Explore Tools", href: "/store" },
    recommendedAppSlugs: [
      "codespace",
      "page-builder",
      "qa-studio",
      "brand-command",
    ],
    defaultTheme: "light",
  },
  {
    id: 4,
    slug: "in-house-dev",
    name: "In-house Dev",
    description: "Developer employed at a company",
    heroText: "Level up your workflow with testing, ops, and collaboration tools.",
    cta: { label: "Get Started", href: "/store" },
    recommendedAppSlugs: [
      "codespace",
      "qa-studio",
      "ops-dashboard",
      "state-machine",
    ],
    defaultTheme: "dark",
  },
  {
    id: 5,
    slug: "ml-engineer",
    name: "ML Engineer",
    description: "ML/AI engineer deploying models to production",
    heroText: "Orchestrate, test, and monitor your ML pipelines in one place.",
    cta: { label: "Start Orchestrating", href: "/store" },
    recommendedAppSlugs: [
      "ai-orchestrator",
      "ops-dashboard",
      "codespace",
      "qa-studio",
    ],
    defaultTheme: "theme-deep-dark",
  },
  {
    id: 6,
    slug: "ai-hobbyist",
    name: "AI Hobbyist",
    description: "Developer exploring AI for fun and learning",
    heroText: "Explore the AI frontier with interactive tools and experiments.",
    cta: { label: "Start Exploring", href: "/store" },
    recommendedAppSlugs: [
      "ai-orchestrator",
      "codespace",
      "app-creator",
      "state-machine",
    ],
    defaultTheme: "dark",
  },
  {
    id: 7,
    slug: "enterprise-devops",
    name: "Enterprise DevOps",
    description: "DevOps engineer in a large organization",
    heroText: "Enterprise-grade ops, testing, and orchestration for your team.",
    cta: { label: "Explore Platform", href: "/store" },
    recommendedAppSlugs: [
      "ops-dashboard",
      "qa-studio",
      "ai-orchestrator",
      "state-machine",
    ],
    defaultTheme: "theme-deep-dark",
  },
  {
    id: 8,
    slug: "startup-devops",
    name: "Startup DevOps",
    description: "DevOps engineer in a small team or startup",
    heroText: "Move fast without breaking things — ops tools built for startups.",
    cta: { label: "Get Started", href: "/store" },
    recommendedAppSlugs: [
      "ops-dashboard",
      "codespace",
      "qa-studio",
      "app-creator",
    ],
    defaultTheme: "theme-deep-dark",
  },
  {
    id: 9,
    slug: "technical-founder",
    name: "Technical Founder",
    description: "Tech-savvy solo founder building a business",
    heroText: "Build, brand, and market your business with AI-powered tools.",
    cta: { label: "Build Your Business", href: "/store" },
    recommendedAppSlugs: [
      "app-creator",
      "brand-command",
      "social-autopilot",
      "ops-dashboard",
    ],
    defaultTheme: "light",
  },
  {
    id: 10,
    slug: "nontechnical-founder",
    name: "Non-technical Founder",
    description: "Non-tech solo founder who needs guided, no-code tools",
    heroText: "No code needed. Build pages, apps, and brand materials with AI assistance.",
    cta: { label: "Get Started", href: "/store" },
    recommendedAppSlugs: [
      "app-creator",
      "page-builder",
      "brand-command",
      "social-autopilot",
    ],
    defaultTheme: "theme-soft-light",
  },
  {
    id: 11,
    slug: "growth-leader",
    name: "Growth Leader",
    description: "Business leader focused on scaling teams and revenue",
    heroText: "Grow your team's reach with social, content, and brand intelligence tools.",
    cta: { label: "Grow Your Reach", href: "/orbit" },
    recommendedAppSlugs: [
      "social-autopilot",
      "brand-command",
      "content-hub",
      "career-navigator",
    ],
    defaultTheme: "light",
  },
  {
    id: 12,
    slug: "ops-leader",
    name: "Ops Leader",
    description: "Business leader optimizing team operations",
    heroText: "Streamline your ops with dashboards, automation, and content workflows.",
    cta: { label: "Optimize Now", href: "/store" },
    recommendedAppSlugs: [
      "ops-dashboard",
      "brand-command",
      "social-autopilot",
      "content-hub",
    ],
    defaultTheme: "dark",
  },
  {
    id: 13,
    slug: "content-creator",
    name: "Content Creator",
    description: "Creator with an audience producing content",
    heroText: "Unleash your creativity with image, page, music, and audio tools.",
    cta: { label: "Start Creating", href: "/store" },
    recommendedAppSlugs: [
      "pixel-studio",
      "page-builder",
      "music-creator",
      "audio-studio",
    ],
    defaultTheme: "theme-soft-light",
  },
  {
    id: 14,
    slug: "hobbyist-creator",
    name: "Hobbyist Creator",
    description: "Person creating art, music, or content for personal enjoyment",
    heroText: "Create for the joy of it — art, music, and design tools at your fingertips.",
    cta: { label: "Start Creating", href: "/store" },
    recommendedAppSlugs: [
      "pixel-studio",
      "music-creator",
      "audio-studio",
      "page-builder",
    ],
    defaultTheme: "theme-soft-light",
  },
  {
    id: 15,
    slug: "social-gamer",
    name: "Social Gamer",
    description: "Person who enjoys multiplayer and social games",
    heroText: "Play chess, tabletop games, and more with friends online.",
    cta: { label: "Find a Game", href: "/apps/chess-arena" },
    recommendedAppSlugs: [
      "chess-arena",
      "tabletop-sim",
      "display-wall",
      "music-creator",
    ],
    defaultTheme: "dark",
  },
  {
    id: 16,
    slug: "solo-explorer",
    name: "Solo Explorer",
    description: "Casual user exploring the platform for personal use",
    heroText: "Discover tools to organize your life, create art, and explore new hobbies.",
    cta: { label: "Start Exploring", href: "/store" },
    recommendedAppSlugs: [
      "cleansweep",
      "pixel-studio",
      "music-creator",
      "career-navigator",
    ],
    defaultTheme: "light",
  },
];

// ── Tree Walker ────────────────────────────────────────────────────────────

const questionMap = new Map(ONBOARDING_TREE.map(q => [q.id, q]));

/**
 * Get the sequence of questions a user will see based on their answers.
 * Returns questions answered so far plus the next unanswered question.
 * With 0 answers returns [q1], with 1 answer returns [q1, next], etc.
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

/**
 * Walk the decision tree with 4 boolean answers and return the matching persona.
 * Returns null if answers don't lead to a valid persona (e.g. wrong length).
 */
export function getPersonaFromAnswers(
  answers: boolean[],
): OnboardingPersona | null {
  if (answers.length !== 4) return null;

  let currentId: string | number = "q1";

  for (const answer of answers) {
    if (typeof currentId === "number") break;

    const question = questionMap.get(currentId);
    if (!question) return null;

    currentId = answer ? question.yesNext : question.noNext;
  }

  if (typeof currentId !== "number") return null;

  return PERSONAS.find(p => p.id === currentId) ?? null;
}

/**
 * Get a persona by its slug.
 */
export function getPersonaBySlug(slug: string): OnboardingPersona | null {
  return PERSONAS.find(p => p.slug === slug) ?? null;
}

/**
 * Derive the best-matching persona slug from AVL-derived tags.
 *
 * Strategy: walk the onboarding decision tree using tag presence as a proxy
 * for how the user would have answered each binary question. The tag keywords
 * are matched against the question's `yesLabel` text (lowercased).
 *
 * Returns the persona slug or null if no match is found.
 */
export function derivePersonaSlugFromTags(tags: string[]): string | null {
  if (tags.length === 0) return null;

  const tagSet = new Set(tags.map(t => t.toLowerCase()));

  // Tag-to-persona keyword mapping.
  // Each persona slug is associated with keywords likely present in its AVL tags.
  const personaKeywords: Array<{ slug: string; keywords: string[]; }> = [
    { slug: "ai-indie", keywords: ["developer", "ai", "startup", "indie"] },
    { slug: "classic-indie", keywords: ["developer", "product", "startup"] },
    {
      slug: "agency-dev",
      keywords: ["developer", "client", "agency", "freelance"],
    },
    { slug: "in-house-dev", keywords: ["developer", "employer", "enterprise"] },
    {
      slug: "ml-engineer",
      keywords: ["developer", "ai", "ml", "production", "model"],
    },
    {
      slug: "ai-hobbyist",
      keywords: ["developer", "ai", "learning", "exploring"],
    },
    {
      slug: "enterprise-devops",
      keywords: ["developer", "devops", "enterprise", "infrastructure"],
    },
    {
      slug: "startup-devops",
      keywords: ["developer", "devops", "startup", "automation"],
    },
    {
      slug: "technical-founder",
      keywords: ["business", "technical", "founder", "startup"],
    },
    {
      slug: "nontechnical-founder",
      keywords: ["business", "founder", "nocode"],
    },
    {
      slug: "growth-leader",
      keywords: ["business", "growth", "marketing", "social"],
    },
    {
      slug: "ops-leader",
      keywords: ["business", "operations", "efficiency", "team"],
    },
    {
      slug: "content-creator",
      keywords: ["creative", "content", "audience", "creator"],
    },
    {
      slug: "hobbyist-creator",
      keywords: ["creative", "art", "hobby", "personal"],
    },
    {
      slug: "social-gamer",
      keywords: ["gaming", "multiplayer", "social", "games"],
    },
    {
      slug: "solo-explorer",
      keywords: ["casual", "explore", "personal", "learning"],
    },
  ];

  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const { slug, keywords } of personaKeywords) {
    let score = 0;
    for (const kw of keywords) {
      if (tagSet.has(kw)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestSlug = slug;
    }
  }

  return bestSlug;
}

/**
 * Data shape stored in WorkspaceConfig.settings
 */
export interface OnboardingData {
  personaId: number;
  personaSlug: string;
  answers: boolean[];
  completedAt: string;
}

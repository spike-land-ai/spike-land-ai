/**
 * Maps each onboarding persona to recommended LearnIt topic slugs.
 * Used to personalize the LearnIt landing page based on the user's persona.
 */

const PERSONA_TOPICS: Record<string, string[]> = {
  "ai-indie": ["machine-learning", "api-design", "saas-architecture", "prompt-engineering"],
  "classic-indie": ["web-development", "javascript", "databases", "deployment"],
  "agency-dev": [
    "project-management",
    "design-systems",
    "responsive-design",
    "client-communication",
  ],
  "in-house-dev": ["software-architecture", "testing", "code-review", "continuous-integration"],
  "ml-engineer": ["neural-networks", "model-deployment", "data-pipelines", "mlops"],
  "ai-hobbyist": ["machine-learning", "python", "natural-language-processing", "computer-vision"],
  "enterprise-devops": ["kubernetes", "monitoring", "infrastructure-as-code", "security"],
  "startup-devops": ["docker", "ci-cd", "cloud-computing", "automation"],
  "technical-founder": ["product-management", "mvp-development", "growth-hacking", "fundraising"],
  "nontechnical-founder": ["no-code-tools", "business-strategy", "marketing", "product-management"],
  "growth-leader": ["growth-hacking", "analytics", "content-marketing", "seo"],
  "ops-leader": ["operations-management", "automation", "team-management", "business-intelligence"],
  "content-creator": ["video-production", "copywriting", "social-media-strategy", "seo"],
  "hobbyist-creator": ["digital-art", "music-production", "creative-writing", "photography"],
  "social-gamer": ["game-design", "multiplayer-gaming", "chess", "tabletop-games"],
  "solo-explorer": ["productivity", "self-improvement", "creative-hobbies", "learning-strategies"],
};

/**
 * Get recommended LearnIt topic slugs for a persona.
 * Returns an empty array if the persona slug is not recognized.
 */
export function getPersonaTopics(personaSlug: string): string[] {
  return PERSONA_TOPICS[personaSlug] ?? [];
}

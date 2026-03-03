export const CHAT_PLACEHOLDERS = [
  "Need help? Just ask...",
  "Type a command or question...",
  "Ask me anything...",
  "Describe what you want to build...",
  "Report a bug or share an idea...",
  "How can I assist you today?",
  "What's on your mind?",
  "Let's create something together...",
  "Looking for a specific feature?",
  "Need to explore the app store?",
];

export const BAZDMEG_PLACEHOLDERS = [
  "Ask about quality gates, CI, or PRs...",
  "Check deployment status...",
  "Are there any open bugs?",
  "Review the latest pull request...",
  "What is the platform health?",
  "Create a new Jira ticket...",
];

export function getRandomPlaceholder(defaultPlaceholder: string = "Ask anything..."): string {
  if (!CHAT_PLACEHOLDERS || CHAT_PLACEHOLDERS.length === 0) return defaultPlaceholder;
  const randomIndex = Math.floor(Math.random() * CHAT_PLACEHOLDERS.length);
  return CHAT_PLACEHOLDERS[randomIndex] ?? defaultPlaceholder;
}

export function getRandomBazdmegPlaceholder(
  defaultPlaceholder: string = "Ask about quality gates, CI, PRs, or give commands...",
): string {
  if (!BAZDMEG_PLACEHOLDERS || BAZDMEG_PLACEHOLDERS.length === 0) return defaultPlaceholder;
  const randomIndex = Math.floor(Math.random() * BAZDMEG_PLACEHOLDERS.length);
  return BAZDMEG_PLACEHOLDERS[randomIndex] ?? defaultPlaceholder;
}

const STOP_WORDS = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "for",
  "with",
  "to",
  "of",
  "in",
  "on",
  "my",
  "do",
]);

export function extractKeywords(topic: string): string[] {
  return topic.toLowerCase().split(/[/\-_\s]+/).filter(k => k && !STOP_WORDS.has(k));
}

export function isCompoundMatch(keyword: string, trigger: string): boolean {
  if (trigger.length < 5) return false;
  return keyword.startsWith(trigger);
}

export function matchesAny(keywords: string[], triggers: string[]): boolean {
  return triggers.some(t => keywords.some(k => k === t || isCompoundMatch(k, t)));
}

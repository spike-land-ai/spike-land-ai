import type { BrandGuardrail, BrandVocabulary } from "@/types/brand-brain";

export type GuardrailStyle = "rewrite" | "score" | "draft";

interface VocabularyLabels {
  banned: string;
  replacement: string;
  arrow: string;
}

const textSeverity: Record<string, string> = {
  LOW: "~",
  MEDIUM: "-",
  HIGH: "!",
  CRITICAL: "!!",
};

const emojiSeverity: Record<string, string> = {
  LOW: "\u26AA",
  MEDIUM: "\uD83D\uDFE1",
  HIGH: "\uD83D\uDFE0",
  CRITICAL: "\uD83D\uDD34",
};

const vocabularyLabels: Record<GuardrailStyle, VocabularyLabels> = {
  rewrite: {
    banned: "Banned Terms (MUST replace)",
    replacement: "Required Replacements",
    arrow: "->",
  },
  score: {
    banned: "Banned Terms",
    replacement: "Replacements",
    arrow: "\u2192",
  },
  draft: {
    banned: "Banned Terms (MUST avoid)",
    replacement: "Required Replacements",
    arrow: "->",
  },
};

export function formatGuardrails(guardrails: BrandGuardrail[], style: GuardrailStyle): string {
  if (!guardrails.length) return "No specific guardrails defined.";

  const useEmoji = style === "score";
  const severityMap = useEmoji ? emojiSeverity : textSeverity;
  const fallback = useEmoji ? "\u26AA" : "-";

  return guardrails
    .map((g) => {
      const icon = severityMap[g.severity] || fallback;
      return `${icon} [${g.type}] ${g.name}: ${g.description || "No description"}`;
    })
    .join("\n");
}

export function formatVocabulary(vocabulary: BrandVocabulary[], style: GuardrailStyle): string {
  if (!vocabulary.length) return "No specific vocabulary rules defined.";

  const labels = vocabularyLabels[style];

  const grouped = {
    PREFERRED: vocabulary.filter((v) => v.type === "PREFERRED"),
    BANNED: vocabulary.filter((v) => v.type === "BANNED"),
    REPLACEMENT: vocabulary.filter((v) => v.type === "REPLACEMENT"),
  };

  const parts: string[] = [];

  if (grouped.PREFERRED.length) {
    parts.push("**Preferred Terms:** " + grouped.PREFERRED.map((v) => v.term).join(", "));
  }
  if (grouped.BANNED.length) {
    parts.push(
      `**${labels.banned}:** ` +
        grouped.BANNED.map((v) => (v.context ? `${v.term} (${v.context})` : v.term)).join(", "),
    );
  }
  if (grouped.REPLACEMENT.length) {
    parts.push(
      `**${labels.replacement}:** ` +
        grouped.REPLACEMENT.map((v) => `"${v.term}" ${labels.arrow} "${v.replacement}"`).join(", "),
    );
  }

  return parts.join("\n") || "No specific vocabulary rules defined.";
}

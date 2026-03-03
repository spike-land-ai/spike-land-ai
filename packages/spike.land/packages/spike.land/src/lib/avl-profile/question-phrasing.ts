/**
 * Question Rephrasing Layer
 *
 * Transforms canonical yes/no questions into engaging, varied UI copy.
 */

export interface RephrasedQuestion {
  headline: string;
  subtext?: string;
  yesLabel: string;
  noLabel: string;
}

const SEED_PHRASINGS: Record<string, RephrasedQuestion> = {
  "Do you write code as part of your work?": {
    headline: "Are you a builder?",
    yesLabel: "I write code",
    noLabel: "Not really",
  },
  "Do you create visual content?": {
    headline: "Got an eye for design?",
    yesLabel: "I'm visual",
    noLabel: "Not my thing",
  },
  "Do you manage social media accounts?": {
    headline: "Are you a social media pro?",
    yesLabel: "That's me",
    noLabel: "Nope",
  },
  "Are you interested in AI and automation?": {
    headline: "Excited about AI?",
    yesLabel: "Absolutely",
    noLabel: "Not yet",
  },
  "Do you work in a team of more than 5 people?": {
    headline: "Part of a bigger team?",
    yesLabel: "Yes, 5+",
    noLabel: "Small team or solo",
  },
  "Do you primarily use mobile devices?": {
    headline: "Are you mobile-first?",
    yesLabel: "Phone life",
    noLabel: "Desktop mostly",
  },
  "Are you interested in music or audio production?": {
    headline: "Into music or audio?",
    yesLabel: "Love it",
    noLabel: "Not really",
  },
};

/**
 * Rephrase a canonical yes/no question into engaging UI copy.
 */
export function rephraseQuestion(
  canonical: string,
  _tags: string[],
  round: number,
): RephrasedQuestion {
  const seed = SEED_PHRASINGS[canonical];

  const base: RephrasedQuestion = seed ?? {
    headline: canonical,
    yesLabel: "Yes",
    noLabel: "No",
  };

  if (round >= 2) {
    return {
      ...base,
      subtext: "We're getting to know you better",
    };
  }

  return base;
}

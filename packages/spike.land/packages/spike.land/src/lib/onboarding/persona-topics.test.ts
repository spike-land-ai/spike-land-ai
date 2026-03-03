import { describe, expect, it } from "vitest";

import { PERSONAS } from "./personas";
import { getPersonaTopics } from "./persona-topics";

const ALL_PERSONA_SLUGS = PERSONAS.map(p => p.slug);

describe("getPersonaTopics", () => {
  it.each(ALL_PERSONA_SLUGS)(
    "returns a non-empty array for persona '%s'",
    slug => {
      const topics = getPersonaTopics(slug);
      expect(topics.length).toBeGreaterThan(0);
      for (const topic of topics) {
        expect(typeof topic).toBe("string");
        expect(topic.length).toBeGreaterThan(0);
      }
    },
  );

  it("returns an empty array for an unknown persona slug", () => {
    expect(getPersonaTopics("unknown-persona")).toEqual([]);
  });

  it("covers all 16 personas", () => {
    expect(ALL_PERSONA_SLUGS).toHaveLength(16);
    for (const slug of ALL_PERSONA_SLUGS) {
      expect(getPersonaTopics(slug).length).toBeGreaterThan(0);
    }
  });
});

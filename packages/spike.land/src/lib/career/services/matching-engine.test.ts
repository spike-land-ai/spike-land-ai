import { describe, expect, it } from "vitest";
import type { Occupation, UserSkill } from "../types";
import { assessSkills, compareSkills } from "./matching-engine";

const makeOccupation = (
  skills: Array<{
    uri: string;
    title: string;
    skillType: "essential" | "optional";
    importance: number;
  }>,
): Occupation => ({
  uri: "http://example.com/occ/1",
  title: "Test Occupation",
  description: "Test description",
  iscoGroup: "2512",
  skills,
  alternativeLabels: [],
});

describe("matching-engine", () => {
  describe("compareSkills", () => {
    it("should return 0 score for occupation with no skills", () => {
      const userSkills: UserSkill[] = [{ uri: "s1", title: "JavaScript", proficiency: 4 }];
      const occupation = makeOccupation([]);

      const result = compareSkills(userSkills, occupation);
      expect(result.score).toBe(0);
      expect(result.matchedSkills).toBe(0);
      expect(result.totalRequired).toBe(0);
      expect(result.gaps).toHaveLength(0);
    });

    it("should match skills by URI", () => {
      const userSkills: UserSkill[] = [{ uri: "s1", title: "JavaScript", proficiency: 5 }];
      const occupation = makeOccupation([
        { uri: "s1", title: "JS", skillType: "essential", importance: 1 },
      ]);

      const result = compareSkills(userSkills, occupation);
      expect(result.matchedSkills).toBe(1);
      expect(result.score).toBeGreaterThan(50);
    });

    it("should match skills by title (case-insensitive)", () => {
      const userSkills: UserSkill[] = [
        { uri: "different-uri", title: "JavaScript", proficiency: 4 },
      ];
      const occupation = makeOccupation([
        {
          uri: "s1",
          title: "javascript",
          skillType: "essential",
          importance: 1,
        },
      ]);

      const result = compareSkills(userSkills, occupation);
      expect(result.matchedSkills).toBe(1);
    });

    it("should detect gaps for missing skills", () => {
      const userSkills: UserSkill[] = [];
      const occupation = makeOccupation([
        { uri: "s1", title: "Python", skillType: "essential", importance: 1 },
      ]);

      const result = compareSkills(userSkills, occupation);
      expect(result.matchedSkills).toBe(0);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]!.userProficiency).toBe(0);
      expect(result.gaps[0]!.requiredLevel).toBe(5); // essential
      expect(result.gaps[0]!.gap).toBe(5);
      expect(result.gaps[0]!.priority).toBe("high");
    });

    it("should set requiredLevel to 3 for optional skills", () => {
      const userSkills: UserSkill[] = [];
      const occupation = makeOccupation([
        { uri: "s1", title: "Docker", skillType: "optional", importance: 0.5 },
      ]);

      const result = compareSkills(userSkills, occupation);
      expect(result.gaps[0]!.requiredLevel).toBe(3);
    });

    it("should assign correct gap priority", () => {
      const userSkills: UserSkill[] = [
        { uri: "s1", title: "Skill A", proficiency: 2 },
        { uri: "s2", title: "Skill B", proficiency: 3 },
        { uri: "s3", title: "Skill C", proficiency: 4 },
      ];
      const occupation = makeOccupation([
        {
          uri: "s1",
          title: "Skill A",
          skillType: "essential",
          importance: 1,
        }, // gap = 3 -> high
        {
          uri: "s2",
          title: "Skill B",
          skillType: "essential",
          importance: 1,
        }, // gap = 2 -> medium
        {
          uri: "s3",
          title: "Skill C",
          skillType: "essential",
          importance: 1,
        }, // gap = 1 -> low
      ]);

      const result = compareSkills(userSkills, occupation);
      const gapBySkill = new Map(result.gaps.map((g) => [g.skill.uri, g]));
      expect(gapBySkill.get("s1")!.priority).toBe("high");
      expect(gapBySkill.get("s2")!.priority).toBe("medium");
      expect(gapBySkill.get("s3")!.priority).toBe("low");
    });

    it("should produce higher score with better skill match", () => {
      const occupation = makeOccupation([
        {
          uri: "s1",
          title: "JavaScript",
          skillType: "essential",
          importance: 1,
        },
        { uri: "s2", title: "React", skillType: "essential", importance: 0.8 },
        {
          uri: "s3",
          title: "TypeScript",
          skillType: "optional",
          importance: 0.5,
        },
      ]);

      const noSkills = compareSkills([], occupation);
      const someSkills = compareSkills(
        [{ uri: "s1", title: "JavaScript", proficiency: 4 }],
        occupation,
      );
      const allSkills = compareSkills(
        [
          { uri: "s1", title: "JavaScript", proficiency: 5 },
          { uri: "s2", title: "React", proficiency: 5 },
          { uri: "s3", title: "TypeScript", proficiency: 5 },
        ],
        occupation,
      );

      expect(noSkills.score).toBeLessThan(someSkills.score);
      expect(someSkills.score).toBeLessThan(allSkills.score);
    });

    it("should cap score between 0 and 100", () => {
      const result = compareSkills(
        [{ uri: "s1", title: "JS", proficiency: 5 }],
        makeOccupation([{ uri: "s1", title: "JS", skillType: "essential", importance: 1 }]),
      );
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe("assessSkills", () => {
    it("should return results sorted by score descending", () => {
      const userSkills: UserSkill[] = [{ uri: "s1", title: "JavaScript", proficiency: 5 }];
      const occupations = [
        makeOccupation([{ uri: "s2", title: "Python", skillType: "essential", importance: 1 }]),
        makeOccupation([
          {
            uri: "s1",
            title: "JavaScript",
            skillType: "essential",
            importance: 1,
          },
        ]),
      ];

      const results = assessSkills(userSkills, occupations);
      expect(results).toHaveLength(2);
      expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score);
    });

    it("should return empty array for empty occupations", () => {
      const results = assessSkills([{ uri: "s1", title: "JS", proficiency: 5 }], []);
      expect(results).toHaveLength(0);
    });
  });
});

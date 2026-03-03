import { describe, expect, it } from "vitest";
import {
  AssessSkillsSchema,
  CompareSkillsSchema,
  GetJobsSchema,
  GetOccupationSchema,
  GetSalarySchema,
  SearchOccupationsSchema,
  SearchSkillsSchema,
  SkillInputSchema,
} from "./schemas";

describe("career schemas", () => {
  describe("SkillInputSchema", () => {
    it("should accept valid skill input", () => {
      const result = SkillInputSchema.safeParse({
        uri: "http://example.com/skill/1",
        title: "JavaScript",
        proficiency: 4,
      });
      expect(result.success).toBe(true);
    });

    it("should reject proficiency below 1", () => {
      const result = SkillInputSchema.safeParse({
        uri: "s1",
        title: "JS",
        proficiency: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject proficiency above 5", () => {
      const result = SkillInputSchema.safeParse({
        uri: "s1",
        title: "JS",
        proficiency: 6,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer proficiency", () => {
      const result = SkillInputSchema.safeParse({
        uri: "s1",
        title: "JS",
        proficiency: 3.5,
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty URI", () => {
      const result = SkillInputSchema.safeParse({
        uri: "",
        title: "JS",
        proficiency: 3,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("AssessSkillsSchema", () => {
    it("should accept valid assessment input", () => {
      const result = AssessSkillsSchema.safeParse({
        skills: [{ uri: "s1", title: "JavaScript", proficiency: 4 }],
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty skills array", () => {
      const result = AssessSkillsSchema.safeParse({ skills: [] });
      expect(result.success).toBe(false);
    });

    it("should reject more than 50 skills", () => {
      const skills = Array.from({ length: 51 }, (_, i) => ({
        uri: `s${i}`,
        title: `Skill ${i}`,
        proficiency: 3,
      }));
      const result = AssessSkillsSchema.safeParse({ skills });
      expect(result.success).toBe(false);
    });

    it("should accept optional limit", () => {
      const result = AssessSkillsSchema.safeParse({
        skills: [{ uri: "s1", title: "JS", proficiency: 3 }],
        limit: 5,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("SearchOccupationsSchema", () => {
    it("should accept valid search query", () => {
      const result = SearchOccupationsSchema.safeParse({
        query: "software developer",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty query", () => {
      const result = SearchOccupationsSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });

    it("should reject query over 200 chars", () => {
      const result = SearchOccupationsSchema.safeParse({
        query: "x".repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GetOccupationSchema", () => {
    it("should accept valid URI", () => {
      const result = GetOccupationSchema.safeParse({
        uri: "http://example.com/occ/1",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty URI", () => {
      const result = GetOccupationSchema.safeParse({ uri: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("CompareSkillsSchema", () => {
    it("should accept valid comparison input", () => {
      const result = CompareSkillsSchema.safeParse({
        skills: [{ uri: "s1", title: "JS", proficiency: 4 }],
        occupationUri: "http://example.com/occ/1",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty occupation URI", () => {
      const result = CompareSkillsSchema.safeParse({
        skills: [{ uri: "s1", title: "JS", proficiency: 4 }],
        occupationUri: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GetSalarySchema", () => {
    it("should accept valid salary lookup", () => {
      const result = GetSalarySchema.safeParse({
        occupationTitle: "Software Engineer",
      });
      expect(result.success).toBe(true);
    });

    it("should accept with country code", () => {
      const result = GetSalarySchema.safeParse({
        occupationTitle: "Software Engineer",
        countryCode: "gb",
      });
      expect(result.success).toBe(true);
    });

    it("should reject country code not exactly 2 chars", () => {
      const result = GetSalarySchema.safeParse({
        occupationTitle: "SE",
        countryCode: "usa",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("GetJobsSchema", () => {
    it("should accept valid job search", () => {
      const result = GetJobsSchema.safeParse({
        query: "frontend developer",
        location: "London",
        countryCode: "gb",
        page: 1,
        limit: 10,
      });
      expect(result.success).toBe(true);
    });

    it("should reject page below 1", () => {
      const result = GetJobsSchema.safeParse({
        query: "developer",
        page: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject limit above 50", () => {
      const result = GetJobsSchema.safeParse({
        query: "developer",
        limit: 51,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("SearchSkillsSchema", () => {
    it("should accept valid skill search", () => {
      const result = SearchSkillsSchema.safeParse({
        query: "programming",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty query", () => {
      const result = SearchSkillsSchema.safeParse({ query: "" });
      expect(result.success).toBe(false);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSearchOccupations = vi.fn();
const mockGetOccupation = vi.fn();
const mockAssessSkills = vi.fn();
const mockCompareSkills = vi.fn();
const mockGetSalaryEstimate = vi.fn();
const mockSearchJobs = vi.fn();

vi.mock("@/lib/career/services/esco-client", () => ({
  searchOccupations: mockSearchOccupations,
  getOccupation: mockGetOccupation,
}));

vi.mock("@/lib/career/services/matching-engine", () => ({
  assessSkills: mockAssessSkills,
  compareSkills: mockCompareSkills,
}));

vi.mock("@/lib/career/services/job-search-client", () => ({
  getSalaryEstimate: mockGetSalaryEstimate,
  searchJobs: mockSearchJobs,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerCareerTools } from "./career";

const sampleOccupation = {
  uri: "http://data.europa.eu/esco/occupation/1",
  title: "Software Developer",
  description: "Develops software applications",
  iscoGroup: "2512",
  skills: [
    {
      uri: "http://data.europa.eu/esco/skill/1",
      title: "JavaScript",
      skillType: "essential" as const,
      importance: 0.9,
    },
    {
      uri: "http://data.europa.eu/esco/skill/2",
      title: "Python",
      skillType: "optional" as const,
      importance: 0.5,
    },
  ],
  alternativeLabels: ["Programmer", "Coder"],
};

const sampleSkills = [
  {
    uri: "http://data.europa.eu/esco/skill/1",
    title: "JavaScript",
    proficiency: 4,
  },
  {
    uri: "http://data.europa.eu/esco/skill/3",
    title: "TypeScript",
    proficiency: 3,
  },
];

const sampleMatchResult = {
  occupation: sampleOccupation,
  score: 75,
  matchedSkills: 1,
  totalRequired: 2,
  gaps: [
    {
      skill: sampleOccupation.skills[1],
      userProficiency: 0,
      requiredLevel: 3,
      gap: 3,
      priority: "high" as const,
    },
  ],
};

const sampleSearchResult = {
  uri: "http://data.europa.eu/esco/occupation/1",
  title: "Software Developer",
  className: "Occupation",
  _links: {
    self: {
      href: "/resource/occupation?uri=http://data.europa.eu/esco/occupation/1",
    },
  },
};

const sampleJob = {
  id: "job-1",
  title: "Senior JS Developer",
  company: "Tech Corp",
  location: "London",
  salary_min: 50000,
  salary_max: 75000,
  currency: "\u00a3",
  description: "Great job",
  url: "https://example.com/job/1",
  created: "2024-01-01",
  category: "IT",
};

describe("career tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCareerTools(registry, userId);
  });

  it("should register 6 career tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
  });

  describe("career_assess_skills", () => {
    it("should return assessment results", async () => {
      mockSearchOccupations.mockResolvedValue({
        results: [sampleSearchResult],
        total: 1,
      });
      mockGetOccupation.mockResolvedValue(sampleOccupation);
      mockAssessSkills.mockReturnValue([sampleMatchResult]);
      const handler = registry.handlers.get("career_assess_skills")!;
      const result = await handler({ skills: sampleSkills });
      expect(getText(result)).toContain("Software Developer");
      expect(getText(result)).toContain("75%");
      expect(getText(result)).toContain("Skills Assessment Results");
    });

    it("should return empty when no occupations found", async () => {
      mockSearchOccupations.mockResolvedValue({ results: [], total: 0 });
      const handler = registry.handlers.get("career_assess_skills")!;
      const result = await handler({ skills: sampleSkills });
      expect(getText(result)).toContain("No matching occupations found");
    });

    it("should show key gaps", async () => {
      mockSearchOccupations.mockResolvedValue({
        results: [sampleSearchResult],
        total: 1,
      });
      mockGetOccupation.mockResolvedValue(sampleOccupation);
      mockAssessSkills.mockReturnValue([sampleMatchResult]);
      const handler = registry.handlers.get("career_assess_skills")!;
      const result = await handler({ skills: sampleSkills });
      expect(getText(result)).toContain("Key gaps");
      expect(getText(result)).toContain("Python");
    });

    it("should respect limit parameter", async () => {
      mockSearchOccupations.mockResolvedValue({
        results: [sampleSearchResult],
        total: 1,
      });
      mockGetOccupation.mockResolvedValue(sampleOccupation);
      mockAssessSkills.mockReturnValue([
        sampleMatchResult,
        sampleMatchResult,
        sampleMatchResult,
      ]);
      const handler = registry.handlers.get("career_assess_skills")!;
      const result = await handler({ skills: sampleSkills, limit: 1 });
      expect(getText(result)).toContain("1 matches");
    });

    it("should return empty when all occupation fetches fail", async () => {
      mockSearchOccupations.mockResolvedValue({
        results: [sampleSearchResult],
        total: 1,
      });
      mockGetOccupation.mockRejectedValue(new Error("API error"));
      const handler = registry.handlers.get("career_assess_skills")!;
      const result = await handler({ skills: sampleSkills });
      expect(getText(result)).toContain("No matching occupations found");
    });

    it("should omit key gaps when no high-priority gaps exist", async () => {
      const noHighGapsResult = {
        ...sampleMatchResult,
        gaps: [
          {
            skill: sampleOccupation.skills[1],
            userProficiency: 2,
            requiredLevel: 3,
            gap: 1,
            priority: "low" as const,
          },
        ],
      };
      mockSearchOccupations.mockResolvedValue({
        results: [sampleSearchResult],
        total: 1,
      });
      mockGetOccupation.mockResolvedValue(sampleOccupation);
      mockAssessSkills.mockReturnValue([noHighGapsResult]);
      const handler = registry.handlers.get("career_assess_skills")!;
      const result = await handler({ skills: sampleSkills });
      expect(getText(result)).not.toContain("Key gaps");
    });

    it("should deduplicate occupation URIs across search results", async () => {
      const skills6 = [
        { uri: "s1", title: "JavaScript", proficiency: 4 },
        { uri: "s2", title: "TypeScript", proficiency: 3 },
        { uri: "s3", title: "Python", proficiency: 3 },
        { uri: "s4", title: "Go", proficiency: 2 },
        { uri: "s5", title: "Rust", proficiency: 2 },
        { uri: "s6", title: "Java", proficiency: 1 },
      ];
      mockSearchOccupations.mockResolvedValue({
        results: [sampleSearchResult, sampleSearchResult],
        total: 2,
      });
      mockGetOccupation.mockResolvedValue(sampleOccupation);
      mockAssessSkills.mockReturnValue([sampleMatchResult]);
      const handler = registry.handlers.get("career_assess_skills")!;
      const result = await handler({ skills: skills6 });
      // Only first 5 skills queried, duplicate URIs deduplicated, so getOccupation called once
      expect(mockGetOccupation).toHaveBeenCalledTimes(1);
      expect(getText(result)).toContain("Skills Assessment Results");
    });
  });

  describe("career_search_occupations", () => {
    it("should return search results", async () => {
      mockSearchOccupations.mockResolvedValue({
        results: [sampleSearchResult],
        total: 1,
      });
      const handler = registry.handlers.get("career_search_occupations")!;
      const result = await handler({ query: "software" });
      expect(getText(result)).toContain("Software Developer");
      expect(getText(result)).toContain("Occupations Found");
    });

    it("should return empty when no results", async () => {
      mockSearchOccupations.mockResolvedValue({ results: [], total: 0 });
      const handler = registry.handlers.get("career_search_occupations")!;
      const result = await handler({ query: "nonexistent" });
      expect(getText(result)).toContain("No occupations found");
    });
  });

  describe("career_get_occupation", () => {
    it("should return occupation details", async () => {
      mockGetOccupation.mockResolvedValue(sampleOccupation);
      const handler = registry.handlers.get("career_get_occupation")!;
      const result = await handler({ uri: sampleOccupation.uri });
      expect(getText(result)).toContain("Software Developer");
      expect(getText(result)).toContain("JavaScript");
      expect(getText(result)).toContain("Essential Skills");
      expect(getText(result)).toContain("Programmer");
    });

    it("should return NOT_FOUND for missing occupation", async () => {
      mockGetOccupation.mockResolvedValue(null);
      const handler = registry.handlers.get("career_get_occupation")!;
      const result = await handler({ uri: "missing" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should show optional skills", async () => {
      mockGetOccupation.mockResolvedValue(sampleOccupation);
      const handler = registry.handlers.get("career_get_occupation")!;
      const result = await handler({ uri: sampleOccupation.uri });
      expect(getText(result)).toContain("Optional Skills");
      expect(getText(result)).toContain("Python");
    });

    it("should omit alternative labels when empty", async () => {
      const noLabels = { ...sampleOccupation, alternativeLabels: [] };
      mockGetOccupation.mockResolvedValue(noLabels);
      const handler = registry.handlers.get("career_get_occupation")!;
      const result = await handler({ uri: noLabels.uri });
      expect(getText(result)).not.toContain("Also known as");
    });

    it("should truncate essential skills over 15", async () => {
      const manySkills = Array.from({ length: 20 }, (_, i) => ({
        uri: `http://data.europa.eu/esco/skill/e${i}`,
        title: `EssentialSkill${i}`,
        skillType: "essential" as const,
        importance: 0.9,
      }));
      const occupation = { ...sampleOccupation, skills: manySkills };
      mockGetOccupation.mockResolvedValue(occupation);
      const handler = registry.handlers.get("career_get_occupation")!;
      const result = await handler({ uri: occupation.uri });
      const text = getText(result);
      expect(text).toContain("Essential Skills (20)");
      expect(text).toContain("...and 5 more");
      expect(text).not.toContain("Optional Skills");
    });

    it("should not show optional skills section when none exist", async () => {
      const essentialOnly = {
        ...sampleOccupation,
        skills: [sampleOccupation.skills[0]],
      };
      mockGetOccupation.mockResolvedValue(essentialOnly);
      const handler = registry.handlers.get("career_get_occupation")!;
      const result = await handler({ uri: essentialOnly.uri });
      expect(getText(result)).not.toContain("Optional Skills");
    });

    it("should truncate optional skills over 10", async () => {
      const manyOptional = Array.from({ length: 15 }, (_, i) => ({
        uri: `http://data.europa.eu/esco/skill/o${i}`,
        title: `OptionalSkill${i}`,
        skillType: "optional" as const,
        importance: 0.3,
      }));
      const occupation = {
        ...sampleOccupation,
        skills: [sampleOccupation.skills[0], ...manyOptional],
      };
      mockGetOccupation.mockResolvedValue(occupation);
      const handler = registry.handlers.get("career_get_occupation")!;
      const result = await handler({ uri: occupation.uri });
      const text = getText(result);
      expect(text).toContain("Optional Skills (15)");
      expect(text).toContain("...and 5 more");
    });
  });

  describe("career_compare_skills", () => {
    it("should return skill comparison", async () => {
      mockGetOccupation.mockResolvedValue(sampleOccupation);
      mockCompareSkills.mockReturnValue(sampleMatchResult);
      const handler = registry.handlers.get("career_compare_skills")!;
      const result = await handler({
        skills: sampleSkills,
        occupationUri: sampleOccupation.uri,
      });
      expect(getText(result)).toContain("Skill Comparison");
      expect(getText(result)).toContain("75%");
      expect(getText(result)).toContain("Priority");
    });

    it("should return NOT_FOUND for missing occupation", async () => {
      mockGetOccupation.mockResolvedValue(null);
      const handler = registry.handlers.get("career_compare_skills")!;
      const result = await handler({
        skills: sampleSkills,
        occupationUri: "missing",
      });
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("career_get_salary", () => {
    it("should return salary data", async () => {
      mockGetSalaryEstimate.mockResolvedValue({
        median: 55000,
        p25: 42000,
        p75: 70000,
        currency: "\u00a3",
        source: "Adzuna",
        location: "United Kingdom",
      });
      const handler = registry.handlers.get("career_get_salary")!;
      const result = await handler({ occupationTitle: "Software Developer" });
      expect(getText(result)).toContain("55,000");
      expect(getText(result)).toContain("Median");
    });

    it("should handle missing salary data", async () => {
      mockGetSalaryEstimate.mockResolvedValue(null);
      const handler = registry.handlers.get("career_get_salary")!;
      const result = await handler({ occupationTitle: "Unknown Job" });
      expect(getText(result)).toContain("not available");
    });
  });

  describe("career_get_jobs", () => {
    it("should return job listings", async () => {
      mockSearchJobs.mockResolvedValue({ jobs: [sampleJob], total: 1 });
      const handler = registry.handlers.get("career_get_jobs")!;
      const result = await handler({ query: "javascript" });
      expect(getText(result)).toContain("Senior JS Developer");
      expect(getText(result)).toContain("Tech Corp");
      expect(getText(result)).toContain("50,000");
    });

    it("should return empty when no jobs found", async () => {
      mockSearchJobs.mockResolvedValue({ jobs: [], total: 0 });
      const handler = registry.handlers.get("career_get_jobs")!;
      const result = await handler({ query: "nonexistent" });
      expect(getText(result)).toContain("No job listings found");
    });

    it("should show salary range", async () => {
      mockSearchJobs.mockResolvedValue({ jobs: [sampleJob], total: 1 });
      const handler = registry.handlers.get("career_get_jobs")!;
      const result = await handler({ query: "javascript" });
      expect(getText(result)).toContain("75,000");
    });

    it("should show 'From' when only salary_min is present", async () => {
      const minOnlyJob = { ...sampleJob, salary_min: 40000, salary_max: null };
      mockSearchJobs.mockResolvedValue({ jobs: [minOnlyJob], total: 1 });
      const handler = registry.handlers.get("career_get_jobs")!;
      const result = await handler({ query: "javascript" });
      const text = getText(result);
      expect(text).toContain("From");
      expect(text).toContain("40,000");
    });

    it("should show 'Up to' when only salary_max is present", async () => {
      const maxOnlyJob = { ...sampleJob, salary_min: null, salary_max: 80000 };
      mockSearchJobs.mockResolvedValue({ jobs: [maxOnlyJob], total: 1 });
      const handler = registry.handlers.get("career_get_jobs")!;
      const result = await handler({ query: "javascript" });
      const text = getText(result);
      expect(text).toContain("Up to");
      expect(text).toContain("80,000");
    });

    it("should omit salary line when both salary_min and salary_max are null", async () => {
      const noSalaryJob = { ...sampleJob, salary_min: null, salary_max: null };
      mockSearchJobs.mockResolvedValue({ jobs: [noSalaryJob], total: 1 });
      const handler = registry.handlers.get("career_get_jobs")!;
      const result = await handler({ query: "javascript" });
      const text = getText(result);
      expect(text).not.toContain("Salary:");
      expect(text).toContain("Senior JS Developer");
    });
  });
});

/**
 * Career Navigator — Standalone Tool Tests
 */

import { describe, expect, it, vi } from "vitest";
import { careerNavigatorTools } from "./tools";
import { createMockContext, createMockRegistry } from "../shared/test-utils";

// Mock external ESCO/Adzuna dependencies
vi.mock("@/lib/career/services/esco-client", () => ({
  searchOccupations: vi.fn().mockResolvedValue({
    results: [
      { uri: "http://esco/1", title: "Software Developer", className: "ICT" },
      { uri: "http://esco/2", title: "Data Analyst", className: "ICT" },
    ],
    total: 2,
  }),
  getOccupation: vi.fn().mockResolvedValue({
    uri: "http://esco/1",
    title: "Software Developer",
    iscoGroup: "2512",
    description: "Develops software applications",
    alternativeLabels: ["Programmer", "Coder"],
    skills: [
      { title: "TypeScript", skillType: "essential" },
      { title: "React", skillType: "essential" },
      { title: "Docker", skillType: "optional" },
    ],
  }),
}));

vi.mock("@/lib/career/services/matching-engine", () => ({
  assessSkills: vi.fn().mockReturnValue([
    {
      occupation: { title: "Software Developer" },
      score: 80,
      matchedSkills: 4,
      totalRequired: 5,
      gaps: [{ priority: "high", skill: { title: "Docker" } }],
    },
  ]),
  compareSkills: vi.fn().mockReturnValue({
    score: 75,
    matchedSkills: 3,
    totalRequired: 4,
    gaps: [
      {
        skill: { title: "Docker" },
        requiredLevel: "advanced",
        userProficiency: "none",
        gap: 3,
        priority: "high",
      },
    ],
  }),
}));

vi.mock("@/lib/career/services/job-search-client", () => ({
  getSalaryEstimate: vi.fn().mockResolvedValue({
    location: "London, UK",
    currency: "\u00a3",
    median: 55000,
    p25: 42000,
    p75: 72000,
    source: "Adzuna",
  }),
  searchJobs: vi.fn().mockResolvedValue({
    jobs: [
      {
        title: "Frontend Dev",
        company: "TechCo",
        location: "London",
        salary_min: 50000,
        salary_max: 70000,
        currency: "\u00a3",
        url: "https://example.com/job/1",
      },
    ],
  }),
}));

describe("careerNavigatorTools", () => {
  const registry = createMockRegistry(careerNavigatorTools);
  const ctx = createMockContext();

  it("exports the correct number of tools", () => {
    expect(careerNavigatorTools.length).toBe(10);
  });

  it("registers tools in expected categories", () => {
    const categories = new Set(careerNavigatorTools.map((t) => t.category));
    expect(categories).toContain("career");
    expect(categories).toContain("career-growth");
  });

  it("career_assess_skills returns matches", async () => {
    const result = await registry.call(
      "career_assess_skills",
      { skills: [{ title: "TypeScript" }, { title: "React" }] },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Skills Assessment Results");
    expect(text).toContain("Software Developer");
  });

  it("career_search_occupations returns results", async () => {
    const result = await registry.call("career_search_occupations", { query: "developer" }, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Occupations Found");
    expect(text).toContain("Software Developer");
  });

  it("career_get_occupation returns full details", async () => {
    const result = await registry.call("career_get_occupation", { uri: "http://esco/1" }, ctx);
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Software Developer");
    expect(text).toContain("Essential Skills");
  });

  it("career_get_salary returns salary data", async () => {
    const result = await registry.call(
      "career_get_salary",
      { occupationTitle: "Software Developer" },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Salary");
    expect(text).toContain("55,000");
  });

  it("career_get_jobs returns job listings", async () => {
    const result = await registry.call(
      "career_get_jobs",
      { query: "frontend developer", location: "London" },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Job Listings");
    expect(text).toContain("Frontend Dev");
  });

  it("career_create_resume creates and scores a resume", async () => {
    const result = await registry.call(
      "career_create_resume",
      {
        name: "Jane Doe",
        email: "jane@example.com",
        summary: "Experienced full-stack developer with 5 years of building web apps.",
        skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker", "AWS", "Git", "GraphQL"],
        experience: [
          {
            title: "Senior Developer",
            company: "TechCorp",
            duration: "2021-2024",
            highlights: ["Led migration to microservices", "Reduced deploy time by 60%"],
          },
          {
            title: "Developer",
            company: "StartupXYZ",
            duration: "2019-2021",
            highlights: ["Built React dashboard", "Implemented CI/CD"],
          },
        ],
      },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Resume Created");
    expect(text).toContain("Completeness Score");
  });

  it("career_get_learning_path returns a path", async () => {
    const result = await registry.call(
      "career_get_learning_path",
      {
        current_skills: ["JavaScript", "HTML"],
        target_occupation: "Frontend Engineer",
      },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Learning Path");
  });

  it("career_interview_prep generates questions", async () => {
    const result = await registry.call(
      "career_interview_prep",
      { occupation: "Backend Engineer", level: "senior", question_count: 5 },
      ctx,
    );
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("Interview Prep");
    expect(text).toContain("Q1.");
  });

  it("all tools have valid tier", () => {
    for (const tool of careerNavigatorTools) {
      expect(["free", "workspace"]).toContain(tool.tier);
    }
  });
});

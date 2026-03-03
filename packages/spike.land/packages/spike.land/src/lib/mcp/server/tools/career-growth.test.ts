import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockRegistry, getText } from "../__test-utils__";
import { registerCareerGrowthTools } from "./career-growth";

describe("career-growth tools", () => {
  const userId = "test-user-456";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCareerGrowthTools(registry, userId);
  });

  // ─── Registration ──────────────────────────────────────────────────────────

  it("should register 4 career-growth tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
  });

  it("should register tools with correct names", () => {
    const names = (registry.register as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => (call[0] as { name: string; }).name,
    );
    expect(names).toContain("career_create_resume");
    expect(names).toContain("career_match_jobs");
    expect(names).toContain("career_get_learning_path");
    expect(names).toContain("career_interview_prep");
  });

  // ─── career_create_resume ──────────────────────────────────────────────────

  describe("career_create_resume", () => {
    const validInput = {
      name: "Jane Doe",
      email: "jane@example.com",
      summary:
        "Experienced software engineer with 5 years building scalable web applications using modern TypeScript and React.",
      skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker", "AWS", "Git", "CSS"],
      experience: [
        {
          title: "Senior Frontend Engineer",
          company: "TechCorp",
          duration: "2021–2023",
          highlights: [
            "Reduced bundle size by 40% through code splitting",
            "Led migration from JavaScript to TypeScript",
          ],
        },
        {
          title: "Frontend Developer",
          company: "StartupABC",
          duration: "2019–2021",
          highlights: [
            "Built design system used across 6 products",
            "Improved page load time from 4s to 1.2s",
          ],
        },
      ],
    };

    it("should create a resume and return an ID", async () => {
      const handler = registry.handlers.get("career_create_resume")!;
      const result = await handler(validInput);
      const text = getText(result);
      expect(text).toContain("Resume Created");
      expect(text).toContain("resume_");
    });

    it("should return a completeness score", async () => {
      const handler = registry.handlers.get("career_create_resume")!;
      const result = await handler(validInput);
      expect(getText(result)).toMatch(/Completeness Score:\*\* \d+\/100/);
    });

    it("should include the formatted resume preview", async () => {
      const handler = registry.handlers.get("career_create_resume")!;
      const result = await handler(validInput);
      const text = getText(result);
      expect(text).toContain("Jane Doe");
      expect(text).toContain("jane@example.com");
      expect(text).toContain("TypeScript");
      expect(text).toContain("TechCorp");
    });

    it("should give a tip when completeness score is low", async () => {
      const sparseInput = {
        ...validInput,
        skills: ["JavaScript"],
        experience: [],
        summary: "Dev.",
      };
      const handler = registry.handlers.get("career_create_resume")!;
      const result = await handler(sparseInput);
      expect(getText(result)).toContain("Tip:");
    });

    it("should not give a tip for a well-completed resume", async () => {
      const handler = registry.handlers.get("career_create_resume")!;
      const result = await handler(validInput);
      // A resume with 8 skills, 2 entries with highlights, and a long summary is above 60
      expect(getText(result)).not.toContain("Tip:");
    });
  });

  // ─── career_match_jobs ─────────────────────────────────────────────────────

  describe("career_match_jobs", () => {
    let resumeId: string;

    beforeEach(async () => {
      const createHandler = registry.handlers.get("career_create_resume")!;
      const createResult = await createHandler({
        name: "Test User",
        email: "test@example.com",
        summary: "Full-stack developer with expertise in TypeScript and React.",
        skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
        experience: [
          {
            title: "Developer",
            company: "Acme",
            duration: "2020–2023",
            highlights: ["Built features", "Fixed bugs"],
          },
        ],
      });
      const idMatch = /resume_\w+/.exec(getText(createResult));
      resumeId = idMatch ? idMatch[0] : "";
    });

    it("should return NOT_FOUND for an unknown resume_id", async () => {
      const handler = registry.handlers.get("career_match_jobs")!;
      const result = await handler({ resume_id: "resume_does_not_exist" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return matched jobs for a valid resume", async () => {
      const handler = registry.handlers.get("career_match_jobs")!;
      const result = await handler({ resume_id: resumeId });
      const text = getText(result);
      expect(text).toContain("Job Matches");
      expect(text).toContain("Match Score");
    });

    it("should include salary ranges in results", async () => {
      const handler = registry.handlers.get("career_match_jobs")!;
      const result = await handler({ resume_id: resumeId });
      expect(getText(result)).toContain("Salary:");
    });

    it("should filter to remote-only jobs when remote_only is true", async () => {
      const handler = registry.handlers.get("career_match_jobs")!;
      const result = await handler({ resume_id: resumeId, remote_only: true });
      const text = getText(result);
      // All listed jobs should be remote
      expect(text).toContain("remote");
    });

    it("should show skills to develop for gap skills", async () => {
      const handler = registry.handlers.get("career_match_jobs")!;
      const result = await handler({ resume_id: resumeId });
      // At least some jobs require skills the user does not have
      expect(getText(result)).toContain("Skills to Develop");
    });
  });

  // ─── career_get_learning_path ──────────────────────────────────────────────

  describe("career_get_learning_path", () => {
    it("should return a learning path for a frontend target", async () => {
      const handler = registry.handlers.get("career_get_learning_path")!;
      const result = await handler({
        current_skills: ["HTML"],
        target_occupation: "Frontend Engineer",
      });
      const text = getText(result);
      expect(text).toContain("Learning Path");
      expect(text).toContain("Frontend Engineer");
      expect(text).toContain("Priority");
    });

    it("should respect the time_budget_hours parameter", async () => {
      const handler = registry.handlers.get("career_get_learning_path")!;
      const result = await handler({
        current_skills: [],
        target_occupation: "DevOps Engineer",
        time_budget_hours: 30,
      });
      const text = getText(result);
      expect(text).toContain("30h budget");
    });

    it("should return a completion message when no skill gaps exist", async () => {
      const handler = registry.handlers.get("career_get_learning_path")!;
      const result = await handler({
        current_skills: ["TypeScript", "React", "CSS", "HTML"],
        target_occupation: "Frontend Engineer",
      });
      const text = getText(result);
      expect(text).toContain("already have the skills");
    });

    it("should show estimated total hours", async () => {
      const handler = registry.handlers.get("career_get_learning_path")!;
      const result = await handler({
        current_skills: [],
        target_occupation: "Backend Engineer",
      });
      expect(getText(result)).toContain("Total Estimated Time");
    });

    it("should list resource suggestions", async () => {
      const handler = registry.handlers.get("career_get_learning_path")!;
      const result = await handler({
        current_skills: [],
        target_occupation: "Backend Engineer",
      });
      // Resource column should be present in the markdown table
      expect(getText(result)).toContain("Resources");
    });
  });

  // ─── career_interview_prep ─────────────────────────────────────────────────

  describe("career_interview_prep", () => {
    it("should return interview questions for a given occupation and level", async () => {
      const handler = registry.handlers.get("career_interview_prep")!;
      const result = await handler({
        occupation: "Software Engineer",
        level: "mid",
      });
      const text = getText(result);
      expect(text).toContain("Interview Prep");
      expect(text).toContain("Software Engineer");
      expect(text).toContain("Q1.");
    });

    it("should default to 10 questions when question_count is omitted", async () => {
      const handler = registry.handlers.get("career_interview_prep")!;
      const result = await handler({
        occupation: "Software Engineer",
        level: "junior",
      });
      const text = getText(result);
      expect(text).toContain("10 questions generated");
    });

    it("should respect the question_count parameter", async () => {
      const handler = registry.handlers.get("career_interview_prep")!;
      const result = await handler({
        occupation: "Backend Developer",
        level: "senior",
        question_count: 5,
      });
      const text = getText(result);
      expect(text).toContain("5 questions generated");
    });

    it("should include behavioral questions", async () => {
      const handler = registry.handlers.get("career_interview_prep")!;
      const result = await handler({
        occupation: "Product Manager",
        level: "mid",
        question_count: 10,
      });
      expect(getText(result)).toContain("behavioral");
    });

    it("should include sample answer outlines", async () => {
      const handler = registry.handlers.get("career_interview_prep")!;
      const result = await handler({
        occupation: "DevOps Engineer",
        level: "senior",
      });
      expect(getText(result)).toContain("Sample Answer Outline");
    });

    it("should include difficulty labels", async () => {
      const handler = registry.handlers.get("career_interview_prep")!;
      const result = await handler({
        occupation: "Data Engineer",
        level: "lead",
      });
      const text = getText(result);
      expect(text).toMatch(/Difficulty: (easy|medium|hard)/);
    });

    it("should include category labels for each question", async () => {
      const handler = registry.handlers.get("career_interview_prep")!;
      const result = await handler({
        occupation: "Frontend Developer",
        level: "junior",
      });
      expect(getText(result)).toContain("Category:");
    });

    it("should include lead-level questions when level is lead", async () => {
      const handler = registry.handlers.get("career_interview_prep")!;
      const result = await handler({
        occupation: "Engineering Lead",
        level: "lead",
        question_count: 15,
      });
      // Lead-level bank includes technical debt / engineering standards questions
      const text = getText(result);
      expect(text.toLowerCase()).toMatch(/technical|behavioral|situational/);
    });
  });
});

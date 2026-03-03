import { describe, expect, it } from "vitest";

import {
  createSkillSchema,
  installSkillSchema,
  SKILL_CONSTANTS,
  skillQuerySchema,
  updateSkillSchema,
} from "./skill";

describe("SKILL_CONSTANTS", () => {
  it("has expected default page size", () => {
    expect(SKILL_CONSTANTS.DEFAULT_PAGE_SIZE).toBe(20);
  });

  it("has expected max page size", () => {
    expect(SKILL_CONSTANTS.MAX_PAGE_SIZE).toBe(100);
  });

  it("has expected max name length", () => {
    expect(SKILL_CONSTANTS.MAX_NAME_LENGTH).toBe(100);
  });
});

describe("createSkillSchema", () => {
  const validInput = {
    name: "my-skill",
    slug: "my-skill",
    displayName: "My Skill",
    description: "A test skill",
    author: "test-author",
  };

  it("accepts valid input", () => {
    const result = createSkillSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createSkillSchema.safeParse({ ...validInput, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects uppercase name", () => {
    const result = createSkillSchema.safeParse({ ...validInput, name: "MySkill" });
    expect(result.success).toBe(false);
  });

  it("rejects name with spaces", () => {
    const result = createSkillSchema.safeParse({ ...validInput, name: "my skill" });
    expect(result.success).toBe(false);
  });

  it("accepts hyphens in name", () => {
    const result = createSkillSchema.safeParse({ ...validInput, name: "my-new-skill" });
    expect(result.success).toBe(true);
  });

  it("strips HTML tags from text fields", () => {
    const result = createSkillSchema.safeParse({
      ...validInput,
      displayName: "<script>alert('xss')</script>My Skill",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).not.toContain("<script>");
      expect(result.data.displayName).toContain("My Skill");
    }
  });

  it("defaults category to OTHER", () => {
    const result = createSkillSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe("OTHER");
    }
  });

  it("defaults status to DRAFT", () => {
    const result = createSkillSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("DRAFT");
    }
  });

  it("validates hex color format", () => {
    const valid = createSkillSchema.safeParse({ ...validInput, color: "#FF0000" });
    expect(valid.success).toBe(true);

    const invalid = createSkillSchema.safeParse({ ...validInput, color: "red" });
    expect(invalid.success).toBe(false);
  });

  it("validates URL fields", () => {
    const valid = createSkillSchema.safeParse({
      ...validInput,
      authorUrl: "https://example.com",
    });
    expect(valid.success).toBe(true);

    const invalid = createSkillSchema.safeParse({
      ...validInput,
      authorUrl: "not-a-url",
    });
    expect(invalid.success).toBe(false);
  });

  it("limits tags array to 20", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    const result = createSkillSchema.safeParse({ ...validInput, tags });
    expect(result.success).toBe(false);
  });

  it("accepts valid categories", () => {
    for (const cat of ["QUALITY", "TESTING", "WORKFLOW", "SECURITY", "PERFORMANCE", "OTHER"]) {
      const result = createSkillSchema.safeParse({ ...validInput, category: cat });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid category", () => {
    const result = createSkillSchema.safeParse({ ...validInput, category: "INVALID" });
    expect(result.success).toBe(false);
  });
});

describe("updateSkillSchema", () => {
  it("requires id", () => {
    const result = updateSkillSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts id with optional fields", () => {
    const result = updateSkillSchema.safeParse({ id: "skill-1" });
    expect(result.success).toBe(true);
  });

  it("accepts partial updates", () => {
    const result = updateSkillSchema.safeParse({
      id: "skill-1",
      displayName: "Updated Name",
      isActive: false,
    });
    expect(result.success).toBe(true);
  });
});

describe("skillQuerySchema", () => {
  it("accepts empty object with defaults", () => {
    const result = skillQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it("coerces string numbers", () => {
    const result = skillQuerySchema.safeParse({ limit: "10", offset: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
    }
  });

  it("rejects limit above max", () => {
    const result = skillQuerySchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects negative offset", () => {
    const result = skillQuerySchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts category filter", () => {
    const result = skillQuerySchema.safeParse({ category: "TESTING" });
    expect(result.success).toBe(true);
  });
});

describe("installSkillSchema", () => {
  it("accepts valid skillId", () => {
    const result = installSkillSchema.safeParse({ skillId: "skill-123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty skillId", () => {
    const result = installSkillSchema.safeParse({ skillId: "" });
    expect(result.success).toBe(false);
  });
});

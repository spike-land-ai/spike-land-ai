import { describe, expect, it } from "vitest";

import {
  agentAppUpdateSchema,
  APP_BUILD_STATUSES,
  APP_MESSAGE_ROLES,
  appCodespaceLinkSchema,
  appCreationSchema,
  appMessageCreateSchema,
  appPromptCreationSchema,
  appSettingsUpdateSchema,
  appStatusUpdateSchema,
  MONETIZATION_MODELS,
  step1Schema,
  step2Schema,
  step3Schema,
} from "./app";

describe("app validations", () => {
  describe("constants", () => {
    it("should have 5 monetization models", () => {
      expect(MONETIZATION_MODELS).toHaveLength(5);
      expect(MONETIZATION_MODELS).toContain("free");
      expect(MONETIZATION_MODELS).toContain("subscription");
    });

    it("should have 9 app build statuses", () => {
      expect(APP_BUILD_STATUSES).toHaveLength(9);
      expect(APP_BUILD_STATUSES).toContain("PROMPTING");
      expect(APP_BUILD_STATUSES).toContain("LIVE");
      expect(APP_BUILD_STATUSES).toContain("ARCHIVED");
    });

    it("should have 3 message roles", () => {
      expect(APP_MESSAGE_ROLES).toEqual(["USER", "AGENT", "SYSTEM"]);
    });
  });

  describe("appCreationSchema", () => {
    const validData = {
      name: "My App",
      description: "A description that is at least 10 characters",
      requirements: "Requirements must be at least twenty characters long",
      monetizationModel: "free" as const,
    };

    it("should accept valid data", () => {
      const result = appCreationSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject name shorter than 3 characters", () => {
      const result = appCreationSchema.safeParse({ ...validData, name: "AB" });
      expect(result.success).toBe(false);
    });

    it("should reject name longer than 50 characters", () => {
      const result = appCreationSchema.safeParse({
        ...validData,
        name: "A".repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it("should reject name with special characters", () => {
      const result = appCreationSchema.safeParse({
        ...validData,
        name: "My@App!",
      });
      expect(result.success).toBe(false);
    });

    it("should reject description shorter than 10 characters", () => {
      const result = appCreationSchema.safeParse({
        ...validData,
        description: "Short",
      });
      expect(result.success).toBe(false);
    });

    it("should reject requirements shorter than 20 characters", () => {
      const result = appCreationSchema.safeParse({
        ...validData,
        requirements: "Too short",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid monetization model", () => {
      const result = appCreationSchema.safeParse({
        ...validData,
        monetizationModel: "premium",
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional codespaceId", () => {
      const result = appCreationSchema.safeParse({
        ...validData,
        codespaceId: "my-code.space_1",
      });
      expect(result.success).toBe(true);
    });

    it("should reject codespaceId with invalid characters", () => {
      const result = appCreationSchema.safeParse({
        ...validData,
        codespaceId: "invalid space!",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("appPromptCreationSchema", () => {
    it("should accept valid prompt", () => {
      const result = appPromptCreationSchema.safeParse({
        prompt: "Build me a simple to-do app",
      });
      expect(result.success).toBe(true);
    });

    it("should reject prompt shorter than 10 chars", () => {
      const result = appPromptCreationSchema.safeParse({ prompt: "Hello" });
      expect(result.success).toBe(false);
    });

    it("should reject prompt longer than 4000 chars", () => {
      const result = appPromptCreationSchema.safeParse({
        prompt: "x".repeat(4001),
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional imageIds", () => {
      const result = appPromptCreationSchema.safeParse({
        prompt: "Build me a simple to-do app",
        imageIds: ["img-1", "img-2"],
      });
      expect(result.success).toBe(true);
    });

    it("should validate codespaceId format", () => {
      const result = appPromptCreationSchema.safeParse({
        prompt: "Build me a simple to-do app",
        codespaceId: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("appMessageCreateSchema", () => {
    it("should accept valid message", () => {
      const result = appMessageCreateSchema.safeParse({
        content: "Hello there",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty content", () => {
      const result = appMessageCreateSchema.safeParse({ content: "" });
      expect(result.success).toBe(false);
    });

    it("should reject content over 10000 chars", () => {
      const result = appMessageCreateSchema.safeParse({
        content: "x".repeat(10001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("appStatusUpdateSchema", () => {
    it("should accept valid status", () => {
      const result = appStatusUpdateSchema.safeParse({ status: "LIVE" });
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = appStatusUpdateSchema.safeParse({ status: "RUNNING" });
      expect(result.success).toBe(false);
    });

    it("should accept optional message", () => {
      const result = appStatusUpdateSchema.safeParse({
        status: "FAILED",
        message: "Build error",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("appSettingsUpdateSchema", () => {
    it("should accept valid partial update", () => {
      const result = appSettingsUpdateSchema.safeParse({
        name: "New Name",
        isPublic: true,
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object (all fields optional)", () => {
      const result = appSettingsUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject name shorter than 3 chars", () => {
      const result = appSettingsUpdateSchema.safeParse({ name: "AB" });
      expect(result.success).toBe(false);
    });
  });

  describe("appCodespaceLinkSchema", () => {
    it("should accept valid codespace ID", () => {
      const result = appCodespaceLinkSchema.safeParse({
        codespaceId: "my-project.dev",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid codespace ID", () => {
      const result = appCodespaceLinkSchema.safeParse({
        codespaceId: "invalid space!",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("agentAppUpdateSchema", () => {
    it("should accept all optional fields", () => {
      const result = agentAppUpdateSchema.safeParse({
        name: "Updated App",
        status: "BUILDING",
        isPublic: true,
        isCurated: false,
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = agentAppUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("step schemas", () => {
    it("step1Schema should validate name and description", () => {
      const result = step1Schema.safeParse({
        name: "My App",
        description: "A nice description",
      });
      expect(result.success).toBe(true);
    });

    it("step2Schema should validate requirements", () => {
      const result = step2Schema.safeParse({
        requirements: "Requirements must be at least twenty characters long",
      });
      expect(result.success).toBe(true);
    });

    it("step3Schema should validate monetization model", () => {
      const result = step3Schema.safeParse({
        monetizationModel: "subscription",
      });
      expect(result.success).toBe(true);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspace: { findFirst: vi.fn() },
  brandProfile: { findUnique: vi.fn() },
  brandGuardrail: { findMany: vi.fn() },
  contentRewrite: { create: vi.fn() },
  policyRule: { findMany: vi.fn() },
  policyCheck: { create: vi.fn() },
  policyViolation: { findMany: vi.fn(), create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBrandBrainTools } from "./brand-brain";

describe("brand-brain tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    mockPrisma.workspace.findFirst.mockResolvedValue({
      id: "ws1",
      slug: "my-ws",
      name: "My Workspace",
    });
    registerBrandBrainTools(registry, userId);
  });

  it("should register 7 brand-brain tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(7);
  });

  describe("brand_score_content", () => {
    it("should score content with no violations", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        id: "bp1",
        vocabulary: [
          { term: "spam", type: "BANNED" },
          { term: "innovative", type: "PREFERRED" },
        ],
        guardrails: [],
      });
      const handler = registry.handlers.get("brand_score_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Our innovative product is great",
      });
      expect(getText(result)).toContain("Brand Score: 100/100");
      expect(getText(result)).toContain("**Violations:** 0");
    });

    it("should detect banned terms", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        id: "bp1",
        vocabulary: [
          { term: "spam", type: "BANNED" },
          { term: "cheap", type: "BANNED" },
        ],
        guardrails: [],
      });
      const handler = registry.handlers.get("brand_score_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Get this cheap spam offer",
      });
      expect(getText(result)).toContain("BANNED_TERM");
      expect(getText(result)).toContain("cheap");
      expect(getText(result)).toContain("spam");
      expect(getText(result)).toContain("70/100");
    });

    it("should detect guardrail keyword violations", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        id: "bp1",
        vocabulary: [],
        guardrails: [
          {
            type: "PROHIBITED_TOPIC",
            name: "competitor-block",
            ruleConfig: { keywords: ["competitor-x"] },
            isActive: true,
          },
        ],
      });
      const handler = registry.handlers.get("brand_score_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Better than competitor-x",
      });
      expect(getText(result)).toContain("GUARDRAIL:competitor-block");
      expect(getText(result)).toContain("competitor-x");
    });

    it("should return error when no brand profile", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("brand_score_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Hello",
      });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should include platform in output when provided", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        id: "bp1",
        vocabulary: [],
        guardrails: [],
      });
      const handler = registry.handlers.get("brand_score_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Hello",
        platform: "TWITTER",
      });
      expect(getText(result)).toContain("**Platform:** TWITTER");
    });

    it("should skip non-BANNED vocabulary types", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        id: "bp1",
        vocabulary: [
          { term: "innovative", type: "PREFERRED" },
          { term: "synergy", type: "FORBIDDEN" },
        ],
        guardrails: [],
      });
      const handler = registry.handlers.get("brand_score_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Our innovative synergy approach",
      });
      expect(getText(result)).toContain("Brand Score: 100/100");
      expect(getText(result)).toContain("**Violations:** 0");
    });

    it("should skip non-PROHIBITED_TOPIC guardrails", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        id: "bp1",
        vocabulary: [],
        guardrails: [
          {
            type: "SENTIMENT_CHECK",
            name: "positive-only",
            ruleConfig: { keywords: ["hate"] },
            isActive: true,
          },
        ],
      });
      const handler = registry.handlers.get("brand_score_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "I hate this",
      });
      expect(getText(result)).toContain("Brand Score: 100/100");
      expect(getText(result)).toContain("**Violations:** 0");
    });

    it("should handle non-array keywords in guardrail ruleConfig", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        id: "bp1",
        vocabulary: [],
        guardrails: [
          {
            type: "PROHIBITED_TOPIC",
            name: "broken-config",
            ruleConfig: { keywords: "not-an-array" },
            isActive: true,
          },
        ],
      });
      const handler = registry.handlers.get("brand_score_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Some content",
      });
      expect(getText(result)).toContain("Brand Score: 100/100");
    });

    it("should skip non-string keywords in guardrail", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        id: "bp1",
        vocabulary: [],
        guardrails: [
          {
            type: "PROHIBITED_TOPIC",
            name: "mixed-keywords",
            ruleConfig: { keywords: [123, null, "badword"] },
            isActive: true,
          },
        ],
      });
      const handler = registry.handlers.get("brand_score_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "This has badword in it",
      });
      expect(getText(result)).toContain("GUARDRAIL:mixed-keywords");
      expect(getText(result)).toContain("**Violations:** 1");
    });
  });

  describe("brand_rewrite_content", () => {
    it("should create a rewrite job", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({ id: "bp1" });
      mockPrisma.contentRewrite.create.mockResolvedValue({
        id: "rw1",
        status: "PENDING",
      });
      const handler = registry.handlers.get("brand_rewrite_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Original content",
        platform: "TWITTER",
        character_limit: 280,
      });
      expect(getText(result)).toContain("Rewrite Submitted");
      expect(getText(result)).toContain("rw1");
      expect(getText(result)).toContain("PENDING");
      expect(getText(result)).toContain("TWITTER");
      expect(getText(result)).toContain("280");
    });

    it("should use default platform GENERAL", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({ id: "bp1" });
      mockPrisma.contentRewrite.create.mockResolvedValue({
        id: "rw2",
        status: "PENDING",
      });
      const handler = registry.handlers.get("brand_rewrite_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Hello world",
      });
      expect(getText(result)).toContain("GENERAL");
      expect(mockPrisma.contentRewrite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ platform: "GENERAL" }),
        }),
      );
    });

    it("should return error when no brand profile", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("brand_rewrite_content")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Hello",
      });
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("brand_get_profile", () => {
    it("should return brand profile with stats", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        name: "Acme Brand",
        mission: "Make great things",
        values: "Quality, Innovation",
        toneDescriptors: "Professional, Friendly",
        guardrails: [{ id: "g1" }, { id: "g2" }],
        vocabulary: [
          { type: "BANNED" },
          { type: "BANNED" },
          { type: "PREFERRED" },
        ],
      });
      const handler = registry.handlers.get("brand_get_profile")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("Acme Brand");
      expect(getText(result)).toContain("Make great things");
      expect(getText(result)).toContain("Quality, Innovation");
      expect(getText(result)).toContain("Professional, Friendly");
      expect(getText(result)).toContain("**Guardrails:** 2");
      expect(getText(result)).toContain("**Vocabulary Terms:** 3");
      expect(getText(result)).toContain("Banned: 2");
      expect(getText(result)).toContain("Preferred: 1");
    });

    it("should show fallback values for null profile fields", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        name: null,
        mission: null,
        values: null,
        toneDescriptors: null,
        guardrails: [],
        vocabulary: [],
      });
      const handler = registry.handlers.get("brand_get_profile")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("**Name:** Unnamed");
      expect(getText(result)).toContain("**Mission:** (none)");
      expect(getText(result)).toContain("**Values:** (none)");
      expect(getText(result)).toContain("**Tone:** (none)");
    });

    it("should return error when no brand profile", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("brand_get_profile")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("brand_check_policy", () => {
    it("should pass when no rules configured", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Hello world",
      });
      expect(getText(result)).toContain("PASSED");
      expect(getText(result)).toContain("No active policy rules");
    });

    it("should fail with critical violations", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([
        {
          id: "rule1",
          name: "No Profanity",
          ruleType: "KEYWORD_MATCH",
          severity: "CRITICAL",
          isActive: true,
          conditions: { keywords: ["badword"] },
        },
      ]);
      mockPrisma.policyCheck.create.mockResolvedValue({ id: "chk1" });
      mockPrisma.policyViolation.create.mockResolvedValue({});
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "This contains badword",
      });
      expect(getText(result)).toContain("FAILED");
      expect(getText(result)).toContain("No Profanity");
      expect(getText(result)).toContain("CRITICAL");
      expect(getText(result)).toContain("badword");
    });

    it("should pass with warnings for low severity", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([
        {
          id: "rule2",
          name: "Tone Check",
          ruleType: "KEYWORD_MATCH",
          severity: "LOW",
          isActive: true,
          conditions: { keywords: ["maybe"] },
        },
      ]);
      mockPrisma.policyCheck.create.mockResolvedValue({ id: "chk2" });
      mockPrisma.policyViolation.create.mockResolvedValue({});
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Maybe we could try",
      });
      expect(getText(result)).toContain("PASSED_WITH_WARNINGS");
      expect(getText(result)).toContain("Tone Check");
    });

    it("should pass when no keywords match", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([
        {
          id: "rule3",
          name: "Brand Filter",
          ruleType: "KEYWORD_MATCH",
          severity: "HIGH",
          isActive: true,
          conditions: { keywords: ["forbidden"] },
        },
      ]);
      mockPrisma.policyCheck.create.mockResolvedValue({ id: "chk3" });
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "All good here",
      });
      expect(getText(result)).toContain("PASSED");
      expect(getText(result)).toContain("**Violations:** 0");
    });

    it("should skip non-KEYWORD_MATCH rule types", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([
        {
          id: "rule4",
          name: "Sentiment Rule",
          ruleType: "SENTIMENT_ANALYSIS",
          severity: "HIGH",
          isActive: true,
          conditions: { keywords: ["badword"] },
        },
      ]);
      mockPrisma.policyCheck.create.mockResolvedValue({ id: "chk4" });
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "This has badword",
      });
      expect(getText(result)).toContain("PASSED");
      expect(getText(result)).toContain("**Violations:** 0");
    });

    it("should handle non-array keywords in policy conditions", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([
        {
          id: "rule5",
          name: "Bad Config",
          ruleType: "KEYWORD_MATCH",
          severity: "HIGH",
          isActive: true,
          conditions: { keywords: "not-an-array" },
        },
      ]);
      mockPrisma.policyCheck.create.mockResolvedValue({ id: "chk5" });
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Some content",
      });
      expect(getText(result)).toContain("PASSED");
      expect(getText(result)).toContain("**Violations:** 0");
    });

    it("should skip non-string keywords in policy conditions", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([
        {
          id: "rule6",
          name: "Mixed Types",
          ruleType: "KEYWORD_MATCH",
          severity: "LOW",
          isActive: true,
          conditions: { keywords: [42, null, "flagged"] },
        },
      ]);
      mockPrisma.policyCheck.create.mockResolvedValue({ id: "chk6" });
      mockPrisma.policyViolation.create.mockResolvedValue({});
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "This is flagged content",
      });
      expect(getText(result)).toContain("PASSED_WITH_WARNINGS");
      expect(getText(result)).toContain("**Violations:** 1");
    });

    it("should include platform in policy check when provided", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "Hello",
        platform: "TWITTER",
      });
      expect(getText(result)).toContain("PASSED");
    });

    it("should fail with HIGH severity violations", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([
        {
          id: "rule7",
          name: "Strict Rule",
          ruleType: "KEYWORD_MATCH",
          severity: "HIGH",
          isActive: true,
          conditions: { keywords: ["offensive"] },
        },
      ]);
      mockPrisma.policyCheck.create.mockResolvedValue({ id: "chk7" });
      mockPrisma.policyViolation.create.mockResolvedValue({});
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "This is offensive",
      });
      expect(getText(result)).toContain("FAILED");
    });

    it("should handle violation with unmatched rule name", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([
        {
          id: "rule8",
          name: "Real Rule",
          ruleType: "KEYWORD_MATCH",
          severity: "LOW",
          isActive: true,
          conditions: { keywords: ["trigger"] },
        },
      ]);
      mockPrisma.policyCheck.create.mockResolvedValue({ id: "chk8" });
      mockPrisma.policyViolation.create.mockResolvedValue({});
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "trigger word here",
      });
      expect(getText(result)).toContain("PASSED_WITH_WARNINGS");
      expect(mockPrisma.policyViolation.create).toHaveBeenCalled();
    });
  });

  describe("brand_list_violations", () => {
    it("should list violations with details", async () => {
      mockPrisma.policyViolation.findMany.mockResolvedValue([
        {
          id: "v1",
          severity: "CRITICAL",
          message: "Matched keyword: badword",
          matchedContent: "badword",
          createdAt: new Date("2024-06-01"),
          rule: { name: "No Profanity" },
          check: { contentType: "POST" },
        },
      ]);
      const handler = registry.handlers.get("brand_list_violations")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("Policy Violations");
      expect(getText(result)).toContain("No Profanity");
      expect(getText(result)).toContain("CRITICAL");
      expect(getText(result)).toContain("badword");
      expect(getText(result)).toContain("POST");
    });

    it("should return empty when no violations", async () => {
      mockPrisma.policyViolation.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("brand_list_violations")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("No violations found");
    });

    it("should filter by severity", async () => {
      mockPrisma.policyViolation.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("brand_list_violations")!;
      await handler({ workspace_slug: "my-ws", severity: "HIGH" });
      expect(mockPrisma.policyViolation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ severity: "HIGH" }),
        }),
      );
    });

    it("should respect limit parameter", async () => {
      mockPrisma.policyViolation.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("brand_list_violations")!;
      await handler({ workspace_slug: "my-ws", limit: 5 });
      expect(mockPrisma.policyViolation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it("should handle violations with null rule, check, and matchedContent", async () => {
      mockPrisma.policyViolation.findMany.mockResolvedValue([
        {
          id: "v2",
          severity: "WARNING",
          message: "Some issue",
          matchedContent: null,
          createdAt: new Date("2024-07-01"),
          rule: null,
          check: null,
        },
      ]);
      const handler = registry.handlers.get("brand_list_violations")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("unknown");
      expect(getText(result)).toContain("N/A");
    });

    it("should not include severity in where clause when not provided", async () => {
      mockPrisma.policyViolation.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("brand_list_violations")!;
      await handler({ workspace_slug: "my-ws" });
      const call = mockPrisma.policyViolation.findMany.mock.calls[0]![0];
      expect(call.where).not.toHaveProperty("severity");
    });
  });

  describe("brand_get_guardrails", () => {
    it("should list active guardrails", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({ id: "bp1" });
      mockPrisma.brandGuardrail.findMany.mockResolvedValue([
        {
          name: "No Competitor Mentions",
          type: "KEYWORD_BLOCK",
          severity: "HIGH",
          description: "Block competitor brand names",
        },
        {
          name: "Tone Guard",
          type: "SENTIMENT",
          severity: "MEDIUM",
          description: "Maintain positive tone",
        },
      ]);
      const handler = registry.handlers.get("brand_get_guardrails")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("Brand Guardrails");
      expect(getText(result)).toContain("No Competitor Mentions");
      expect(getText(result)).toContain("KEYWORD_BLOCK");
      expect(getText(result)).toContain("HIGH");
      expect(getText(result)).toContain("Tone Guard");
      expect(getText(result)).toContain("SENTIMENT");
    });

    it("should return empty when no guardrails", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({ id: "bp1" });
      mockPrisma.brandGuardrail.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("brand_get_guardrails")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("No active guardrails found");
    });

    it("should show 'No description' for guardrails with null description", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({ id: "bp1" });
      mockPrisma.brandGuardrail.findMany.mockResolvedValue([
        {
          name: "Simple Guard",
          type: "KEYWORD_BLOCK",
          severity: "LOW",
          description: null,
        },
      ]);
      const handler = registry.handlers.get("brand_get_guardrails")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("No description");
    });

    it("should return error when no brand profile", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("brand_get_guardrails")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("analyze_brand_voice", () => {
    it("should return brand voice analysis with vocabulary and guardrails", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        name: "Acme Brand",
        mission: "Make great things",
        values: "Quality, Innovation",
        toneDescriptors: "Professional, Friendly",
        guardrails: [
          {
            name: "No Competitors",
            severity: "HIGH",
            description: "Block competitor names",
          },
        ],
        vocabulary: [
          { term: "innovative", type: "PREFERRED" },
          { term: "cheap", type: "BANNED" },
        ],
      });
      const handler = registry.handlers.get("analyze_brand_voice")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("Brand Voice Analysis");
      expect(getText(result)).toContain("Acme Brand");
      expect(getText(result)).toContain("Make great things");
      expect(getText(result)).toContain("Quality, Innovation");
      expect(getText(result)).toContain("Professional, Friendly");
      expect(getText(result)).toContain("innovative");
      expect(getText(result)).toContain("cheap");
      expect(getText(result)).toContain("No Competitors");
    });

    it("should use default workspace when slug is omitted", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        name: "Default Brand",
        mission: null,
        values: null,
        toneDescriptors: null,
        guardrails: [],
        vocabulary: [],
      });
      const handler = registry.handlers.get("analyze_brand_voice")!;
      const result = await handler({});
      expect(getText(result)).toContain("Brand Voice Analysis");
      expect(getText(result)).toContain("Default Brand");
      expect(mockPrisma.workspace.findFirst).toHaveBeenCalled();
    });

    it("should return error when no brand profile found", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("analyze_brand_voice")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should handle profile with empty vocabulary and guardrails", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        name: "Minimal Brand",
        mission: null,
        values: null,
        toneDescriptors: null,
        guardrails: [],
        vocabulary: [],
      });
      const handler = registry.handlers.get("analyze_brand_voice")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("Minimal Brand");
      expect(getText(result)).toContain("Preferred terms (0)");
      expect(getText(result)).toContain("Banned terms (0)");
      expect(getText(result)).toContain("Active Guardrails (0)");
    });

    it("should throw when no workspace found for user (slug omitted)", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue(null);
      mockPrisma.brandProfile.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("analyze_brand_voice")!;
      const result = await handler({});
      expect(getText(result)).toContain("No workspace found");
    });

    it("should show guardrail with null description as 'No description'", async () => {
      mockPrisma.brandProfile.findUnique.mockResolvedValue({
        name: "TestBrand",
        mission: "Test",
        values: "Test",
        toneDescriptors: "Test",
        guardrails: [
          { name: "Guard1", severity: "HIGH", description: null },
        ],
        vocabulary: [],
      });
      const handler = registry.handlers.get("analyze_brand_voice")!;
      const result = await handler({ workspace_slug: "my-ws" });
      expect(getText(result)).toContain("No description");
    });
  });

  describe("brand_check_policy - violation with matched rule creates policyViolation", () => {
    it("should create policyViolation for each violation with matching rule", async () => {
      mockPrisma.policyRule.findMany.mockResolvedValue([
        {
          id: "rule-a",
          name: "Block Bad Words",
          ruleType: "KEYWORD_MATCH",
          severity: "CRITICAL",
          isActive: true,
          conditions: { keywords: ["badword1", "badword2"] },
        },
      ]);
      mockPrisma.policyCheck.create.mockResolvedValue({ id: "chk-multi" });
      mockPrisma.policyViolation.create.mockResolvedValue({});
      const handler = registry.handlers.get("brand_check_policy")!;
      const result = await handler({
        workspace_slug: "my-ws",
        content: "badword1 and badword2",
      });
      expect(getText(result)).toContain("FAILED");
      // Two violations, both matching the same rule
      expect(mockPrisma.policyViolation.create).toHaveBeenCalledTimes(2);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/gemini-client", () => ({
  generateStructuredResponse: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("./persona-service", () => ({
  bulkCreatePersonas: vi.fn(),
  recalculateRanks: vi.fn(),
}));

const { generateStructuredResponse } = await import("@/lib/ai/gemini-client");
const { bulkCreatePersonas, recalculateRanks } = await import("./persona-service");
const { generatePersonas, generateAndSavePersonas, generateTargetedPersona } = await import(
  "./persona-generator"
);

const validPersona = {
  slug: "startup-steve",
  name: "Startup Steve",
  tagline: "Early-stage founder who needs AI fast",
  demographics: {
    age: "25-35",
    gender: "Male",
    income: "$50k-$100k",
    location: "San Francisco",
    platform: "LinkedIn",
    jobTitle: "CEO",
  },
  psychographics: ["growth-oriented", "risk-taker"],
  painPoints: ["no tech team", "limited budget"],
  triggers: ["missed deadline", "competitor launched AI feature"],
  primaryHook: "Ship AI features without hiring a team",
  adCopyVariations: ["Copy 1", "Copy 2", "Copy 3"],
  predictedProfit: 75,
  stressLevel: 8,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("generatePersonas", () => {
  it("returns validated personas from AI", async () => {
    vi.mocked(generateStructuredResponse).mockResolvedValue([validPersona]);
    const result = await generatePersonas(1);
    expect(result).toHaveLength(1);
    expect(result[0]!.slug).toBe("startup-steve");
  });

  it("filters out invalid personas", async () => {
    vi.mocked(generateStructuredResponse).mockResolvedValue([
      validPersona,
      { slug: "bad", name: "Missing fields" }, // incomplete
    ]);
    const result = await generatePersonas(2);
    expect(result).toHaveLength(1);
  });

  it("passes industry context to prompt", async () => {
    vi.mocked(generateStructuredResponse).mockResolvedValue([validPersona]);
    await generatePersonas(1, "healthcare");
    expect(generateStructuredResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("healthcare"),
      }),
    );
  });

  it("throws when AI call fails", async () => {
    vi.mocked(generateStructuredResponse).mockRejectedValue(new Error("AI unavailable"));
    await expect(generatePersonas(1)).rejects.toThrow("AI unavailable");
  });
});

describe("generateAndSavePersonas", () => {
  it("generates and saves personas", async () => {
    vi.mocked(generateStructuredResponse).mockResolvedValue([validPersona]);
    vi.mocked(bulkCreatePersonas).mockResolvedValue(1);
    vi.mocked(recalculateRanks).mockResolvedValue(undefined);

    const result = await generateAndSavePersonas(1);
    expect(result.generated).toBe(1);
    expect(result.saved).toBe(1);
    expect(bulkCreatePersonas).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ slug: "startup-steve", rank: 1 })]),
    );
    expect(recalculateRanks).toHaveBeenCalled();
  });
});

describe("generateTargetedPersona", () => {
  it("returns a persona matching criteria", async () => {
    vi.mocked(generateStructuredResponse).mockResolvedValue(validPersona);
    const result = await generateTargetedPersona({
      industry: "tech",
      companySize: "startup",
      urgency: "high",
      budget: "medium",
    });
    expect(result).not.toBeNull();
    expect(result?.slug).toBe("startup-steve");
  });

  it("includes criteria in prompt", async () => {
    vi.mocked(generateStructuredResponse).mockResolvedValue(validPersona);
    await generateTargetedPersona({
      industry: "healthcare",
      companySize: "enterprise",
      urgency: "low",
      budget: "high",
    });
    expect(generateStructuredResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("healthcare"),
      }),
    );
  });

  it("returns null for invalid AI response", async () => {
    vi.mocked(generateStructuredResponse).mockResolvedValue({
      slug: "bad",
    });
    const result = await generateTargetedPersona({
      industry: "tech",
      companySize: "startup",
      urgency: "high",
      budget: "low",
    });
    expect(result).toBeNull();
  });

  it("returns null when AI call fails", async () => {
    vi.mocked(generateStructuredResponse).mockRejectedValue(new Error("fail"));
    const result = await generateTargetedPersona({
      industry: "tech",
      companySize: "startup",
      urgency: "high",
      budget: "low",
    });
    expect(result).toBeNull();
  });
});

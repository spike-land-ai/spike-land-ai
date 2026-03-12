import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// We must mock readline before importing the module so that the mock is in
// place when the module is first evaluated.
const mockRlQuestion = vi.hoisted(() => vi.fn());
const mockRlClose = vi.hoisted(() => vi.fn());
const mockCreateInterface = vi.hoisted(() =>
  vi.fn(() => ({
    question: mockRlQuestion,
    close: mockRlClose,
  })),
);

vi.mock("node:readline", () => ({
  createInterface: mockCreateInterface,
}));

// Mock global fetch for submitOnboarding tests
const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

import {
  runOnboardingWizard,
  submitOnboarding,
} from "../../../../src/cli/spike-cli/core-logic/onboarding/wizard.js";

describe("runOnboardingWizard", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  /**
   * Helper: sets up readline mock to respond to each question in order.
   * The wizard asks branching questions — answers are consumed sequentially.
   */
  function setupAnswers(answers: string[]): void {
    let callIndex = 0;
    mockRlQuestion.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
      callback(answers[callIndex++] ?? "n");
    });
  }

  // All-no path: q1(n) → q2-nontech(n) → q3-personal(n) → q4-casual(n) → persona 16 (Solo Explorer)
  it("returns Solo Explorer when all answers are no", async () => {
    setupAnswers(["n", "n", "n", "n"]);

    const result = await runOnboardingWizard();

    expect(result.personaId).toBe(16);
    expect(result.personaSlug).toBe("solo-explorer");
    expect(result.personaName).toBe("Solo Explorer");
    expect(result.answers).toEqual([false, false, false, false]);
    expect(result.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  // All-yes path: q1(y) → q2-tech(y) → q3-product(y) → q4-indie(y) → persona 1 (AI Indie)
  it("returns AI Indie when all answers are yes", async () => {
    setupAnswers(["y", "y", "y", "y"]);

    const result = await runOnboardingWizard();

    expect(result.personaId).toBe(1);
    expect(result.personaSlug).toBe("ai-indie");
    expect(result.personaName).toBe("AI Indie");
    expect(result.answers).toEqual([true, true, true, true]);
  });

  it("treats answers starting with 'y' as truthy", async () => {
    setupAnswers(["yes", "yep", "Y", "YES"]);

    const result = await runOnboardingWizard();

    expect(result.answers).toEqual([true, true, true, true]);
  });

  it("treats answers not starting with 'y' as falsy", async () => {
    setupAnswers(["no", "nope", "N", "maybe"]);

    const result = await runOnboardingWizard();

    expect(result.answers).toEqual([false, false, false, false]);
  });

  // q1(y) → q2-tech(n) → q3-platform(n) → q4-devops(n) → persona 8 (Startup DevOps)
  it("follows branching path to Startup DevOps for [y, n, n, n]", async () => {
    setupAnswers(["y", "n", "n", "n"]);

    const result = await runOnboardingWizard();

    expect(result.personaId).toBe(8);
    expect(result.personaSlug).toBe("startup-devops");
  });

  // q1(n) → q2-nontech(y) → q3-business(y) → q4-solofound(n) → persona 10 (Non-technical Founder)
  it("follows branching path to Non-technical Founder for [n, y, y, n]", async () => {
    setupAnswers(["n", "y", "y", "n"]);

    const result = await runOnboardingWizard();

    expect(result.personaId).toBe(10);
    expect(result.personaSlug).toBe("nontechnical-founder");
  });

  // q1(n) → q2-nontech(n) → q3-personal(y) → q4-creative(y) → persona 13 (Content Creator)
  it("follows branching path to Content Creator for [n, n, y, y]", async () => {
    setupAnswers(["n", "n", "y", "y"]);

    const result = await runOnboardingWizard();

    expect(result.personaId).toBe(13);
    expect(result.personaSlug).toBe("content-creator");
  });

  it("closes the readline interface after wizard completes", async () => {
    setupAnswers(["n", "n", "n", "n"]);

    await runOnboardingWizard();

    expect(mockRlClose).toHaveBeenCalled();
  });

  it("closes readline even if an error occurs mid-wizard", async () => {
    let callIndex = 0;
    mockRlQuestion.mockImplementation((_prompt: string, callback: (answer: string) => void) => {
      callIndex++;
      if (callIndex === 2) {
        throw new Error("readline exploded");
      }
      callback("n");
    });

    await expect(runOnboardingWizard()).rejects.toThrow("readline exploded");
    expect(mockRlClose).toHaveBeenCalled();
  });

  it("prints welcome message to stderr", async () => {
    setupAnswers(["n", "n", "n", "n"]);

    await runOnboardingWizard();

    const output = errorSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("personalize");
  });

  it("asks exactly 4 questions (one per tree level)", async () => {
    setupAnswers(["n", "n", "n", "n"]);

    await runOnboardingWizard();

    expect(mockRlQuestion).toHaveBeenCalledTimes(4);
  });

  it("question prompts include yes/no labels", async () => {
    setupAnswers(["y", "y", "y", "y"]);

    await runOnboardingWizard();

    // First question should mention the yes/no labels
    const firstPrompt = mockRlQuestion.mock.calls[0][0] as string;
    expect(firstPrompt).toContain("Yes, I code");
    expect(firstPrompt).toContain("No, I don't");
  });

  it("second question depends on first answer (branching)", async () => {
    // Path 1: q1(y) → q2-tech
    setupAnswers(["y", "y", "y", "y"]);
    await runOnboardingWizard();
    const secondPromptYes = mockRlQuestion.mock.calls[1][0] as string;

    vi.clearAllMocks();

    // Path 2: q1(n) → q2-nontech
    setupAnswers(["n", "n", "n", "n"]);
    await runOnboardingWizard();
    const secondPromptNo = mockRlQuestion.mock.calls[1][0] as string;

    // The second questions should differ based on branching
    expect(secondPromptYes).toContain("What do you mainly build?");
    expect(secondPromptNo).toContain("What's your primary goal?");
  });
});

describe("submitOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
  });

  const sampleResult = {
    personaId: 1,
    personaSlug: "ai-indie",
    personaName: "AI Indie",
    answers: [true, true, true, true],
    completedAt: "2024-01-01T00:00:00.000Z",
  };

  it("POSTs to the correct endpoint", async () => {
    await submitOnboarding(sampleResult, "https://spike.land", "my-token");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://spike.land/api/onboarding",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends Authorization header with bearer token", async () => {
    await submitOnboarding(sampleResult, "https://spike.land", "my-token");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer my-token");
  });

  it("sends Content-Type application/json", async () => {
    await submitOnboarding(sampleResult, "https://spike.land", "tok");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sends the result payload as JSON body", async () => {
    await submitOnboarding(sampleResult, "https://spike.land", "tok");

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as typeof sampleResult;
    expect(body.personaId).toBe(1);
    expect(body.personaSlug).toBe("ai-indie");
  });

  it("uses the provided baseUrl in the request", async () => {
    await submitOnboarding(sampleResult, "https://custom.example.com", "tok");

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("https://custom.example.com");
  });
});

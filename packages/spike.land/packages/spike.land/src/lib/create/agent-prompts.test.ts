import { describe, expect, it } from "vitest";

import {
  AGENT_IDENTITY,
  buildAgentSystemPrompt,
  buildAgentUserPrompt,
  buildFixSystemPrompt,
  buildFixUserPrompt,
  NOTE_EXTRACTION_PROMPT,
  OUTPUT_SPEC,
} from "./agent-prompts";

import type { LearningNote } from "./agent-prompts";

const sampleNotes: LearningNote[] = [
  {
    id: "n1",
    trigger: "framer-motion AnimatePresence",
    lesson: "Always wrap children in motion.div with exit prop",
    confidenceScore: 0.9,
  },
  {
    id: "n2",
    trigger: "recharts ResponsiveContainer",
    lesson: "Must set explicit width/height on parent",
    confidenceScore: 0.8,
  },
];

describe("re-exported constants", () => {
  it("AGENT_IDENTITY is a non-empty string", () => {
    expect(AGENT_IDENTITY.length).toBeGreaterThan(0);
  });

  it("OUTPUT_SPEC is a non-empty string", () => {
    expect(OUTPUT_SPEC.length).toBeGreaterThan(0);
  });
});

describe("buildAgentSystemPrompt", () => {
  it("returns a SplitPrompt object", () => {
    const result = buildAgentSystemPrompt("chart dashboard", []);
    expect(result).toHaveProperty("full");
    expect(result).toHaveProperty("stablePrefix");
    expect(result).toHaveProperty("dynamicSuffix");
  });

  it("includes identity in stablePrefix", () => {
    const result = buildAgentSystemPrompt("chart", []);
    expect(result.stablePrefix).toContain(AGENT_IDENTITY);
  });

  it("includes output spec in stablePrefix", () => {
    const result = buildAgentSystemPrompt("chart", []);
    expect(result.stablePrefix).toContain("OUTPUT FORMAT");
  });

  it("has empty dynamicSuffix when no notes", () => {
    const result = buildAgentSystemPrompt("chart", []);
    expect(result.dynamicSuffix).toBe("");
  });

  it("includes notes in dynamicSuffix", () => {
    const result = buildAgentSystemPrompt("chart", sampleNotes);
    expect(result.dynamicSuffix).toContain("Lessons Learned");
    expect(result.dynamicSuffix).toContain("framer-motion");
  });

  it("full is the concatenation of prefix and suffix", () => {
    const result = buildAgentSystemPrompt("chart", sampleNotes);
    expect(result.full).toContain(result.stablePrefix);
    expect(result.full).toContain(result.dynamicSuffix);
  });

  it("full equals stablePrefix when no notes", () => {
    const result = buildAgentSystemPrompt("chart", []);
    expect(result.full).toBe(result.stablePrefix);
  });

  it("sorts notes by confidence (highest first)", () => {
    const notes: LearningNote[] = [
      { id: "a", trigger: "low", lesson: "Low confidence", confidenceScore: 0.1 },
      { id: "b", trigger: "high", lesson: "High confidence", confidenceScore: 0.99 },
    ];
    const result = buildAgentSystemPrompt("chart", notes);
    const highIdx = result.dynamicSuffix.indexOf("high");
    const lowIdx = result.dynamicSuffix.indexOf("low");
    expect(highIdx).toBeLessThan(lowIdx);
  });
});

describe("buildAgentUserPrompt", () => {
  it("returns string when no images", () => {
    const result = buildAgentUserPrompt(["games", "tetris"]);
    expect(typeof result).toBe("string");
    expect(result as string).toContain("games/tetris");
  });

  it("returns string when empty images array", () => {
    const result = buildAgentUserPrompt(["games", "tetris"], []);
    expect(typeof result).toBe("string");
  });

  it("returns content blocks array when images provided", () => {
    const result = buildAgentUserPrompt(["games", "tetris"], [
      "https://example.com/img.png",
    ]);
    expect(Array.isArray(result)).toBe(true);
    const blocks = result as Array<{ type: string; }>;
    expect(blocks.some(b => b.type === "text")).toBe(true);
    expect(blocks.some(b => b.type === "image")).toBe(true);
  });

  it("includes reference image instruction text", () => {
    const result = buildAgentUserPrompt(["tools"], [
      "https://example.com/img.png",
    ]);
    const blocks = result as Array<{ type: string; text?: string; }>;
    const lastTextBlock = blocks.filter(b => b.type === "text").pop();
    expect(lastTextBlock?.text).toContain("reference image");
  });
});

describe("buildFixSystemPrompt", () => {
  it("returns a SplitPrompt object", () => {
    const result = buildFixSystemPrompt("chart", []);
    expect(result).toHaveProperty("full");
    expect(result).toHaveProperty("stablePrefix");
    expect(result).toHaveProperty("dynamicSuffix");
  });

  it("includes fix-specific content", () => {
    const result = buildFixSystemPrompt("chart", []);
    expect(result.stablePrefix).toContain("debugger");
    expect(result.stablePrefix).toContain("OUTPUT FORMAT");
  });

  it("includes notes in dynamicSuffix", () => {
    const result = buildFixSystemPrompt("chart", sampleNotes);
    expect(result.dynamicSuffix).toContain("Lessons Learned");
  });
});

describe("buildFixUserPrompt", () => {
  it("includes the error and code", () => {
    const result = buildFixUserPrompt("const x = 1;", "Syntax error", []);
    expect(result).toContain("Syntax error");
    expect(result).toContain("const x = 1;");
  });

  it("includes previous errors when present", () => {
    const result = buildFixUserPrompt("code", "error", [
      { error: "prev error 1", iteration: 0 },
      { error: "prev error 2", iteration: 1 },
    ]);
    expect(result).toContain("Attempt 1");
    expect(result).toContain("Attempt 2");
    expect(result).toContain("prev error 1");
  });

  it("includes structured error context", () => {
    const result = buildFixUserPrompt("code", "error", [], {
      type: "import",
      library: "recharts",
      lineNumber: 5,
      suggestion: "Use named export",
    });
    expect(result).toContain("ERROR TYPE: import");
    expect(result).toContain("LIBRARY: recharts");
    expect(result).toContain("LINE: 5");
    expect(result).toContain("SUGGESTION: Use named export");
  });

  it("omits structured fields that are undefined", () => {
    const result = buildFixUserPrompt("code", "error", [], {
      type: "transpile",
    });
    expect(result).toContain("ERROR TYPE: transpile");
    expect(result).not.toContain("LIBRARY:");
    expect(result).not.toContain("LINE:");
    expect(result).not.toContain("SUGGESTION:");
  });
});

describe("NOTE_EXTRACTION_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(NOTE_EXTRACTION_PROMPT.length).toBeGreaterThan(0);
  });

  it("includes expected fields", () => {
    expect(NOTE_EXTRACTION_PROMPT).toContain("trigger");
    expect(NOTE_EXTRACTION_PROMPT).toContain("lesson");
    expect(NOTE_EXTRACTION_PROMPT).toContain("libraries");
  });
});

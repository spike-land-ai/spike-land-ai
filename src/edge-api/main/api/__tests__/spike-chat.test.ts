import { describe, it, expect } from "vitest";
import {
  buildAetherSystemPrompt,
  buildClassifyPrompt,
  buildPlanPrompt,
  buildExtractPrompt,
  type UserMemory,
  type AetherNote,
} from "../../core-logic/aether-prompt";
import {
  selectNotes,
  updateNoteConfidence,
  pruneNotes,
  parseExtractedNote,
} from "../../core-logic/aether-memory";
import { buildSpikeChatMessages } from "../routes/spike-chat";

// --- Prompt Builder Tests ---

describe("buildAetherSystemPrompt", () => {
  it("returns stable prefix that never changes", () => {
    const empty: UserMemory = { lifeSummary: "", notes: [], currentGoals: [] };
    const withNotes: UserMemory = {
      lifeSummary: "A developer",
      notes: [makeNote({ trigger: "code review", lesson: "prefers concise feedback" })],
      currentGoals: ["Ship v2"],
    };

    const a = buildAetherSystemPrompt(empty);
    const b = buildAetherSystemPrompt(withNotes);

    expect(a.stablePrefix).toBe(b.stablePrefix);
    expect(a.stablePrefix).toContain("You are Spike");
  });

  it("includes user life summary in dynamic suffix", () => {
    const state: UserMemory = {
      lifeSummary: "Full-stack developer from Budapest",
      notes: [],
      currentGoals: [],
    };
    const { dynamicSuffix } = buildAetherSystemPrompt(state);
    expect(dynamicSuffix).toContain("Full-stack developer from Budapest");
  });

  it("includes notes in dynamic suffix", () => {
    const state: UserMemory = {
      lifeSummary: "",
      notes: [makeNote({ trigger: "TypeScript question", lesson: "prefers strict mode" })],
      currentGoals: [],
    };
    const { dynamicSuffix } = buildAetherSystemPrompt(state);
    expect(dynamicSuffix).toContain("TypeScript question");
    expect(dynamicSuffix).toContain("prefers strict mode");
  });

  it("includes goals in dynamic suffix", () => {
    const state: UserMemory = {
      lifeSummary: "",
      notes: [],
      currentGoals: ["Launch app store", "Fix CI"],
    };
    const { dynamicSuffix } = buildAetherSystemPrompt(state);
    expect(dynamicSuffix).toContain("Launch app store");
    expect(dynamicSuffix).toContain("Fix CI");
  });

  it("returns empty dynamic suffix when no user state", () => {
    const state: UserMemory = { lifeSummary: "", notes: [], currentGoals: [] };
    const { dynamicSuffix } = buildAetherSystemPrompt(state);
    expect(dynamicSuffix).toBe("");
  });
});

describe("buildClassifyPrompt", () => {
  it("returns a prompt mentioning JSON", () => {
    expect(buildClassifyPrompt()).toContain("JSON");
  });
});

describe("buildPlanPrompt", () => {
  it("includes classified intent and tools", () => {
    const prompt = buildPlanPrompt('{"intent":"task"}', ["search", "calculate"]);
    expect(prompt).toContain('{"intent":"task"}');
    expect(prompt).toContain("search");
    expect(prompt).toContain("calculate");
  });

  it("handles empty tools", () => {
    const prompt = buildPlanPrompt("{}", []);
    expect(prompt).toContain("No tools available");
  });
});

describe("buildExtractPrompt", () => {
  it("returns a prompt mentioning extraction", () => {
    expect(buildExtractPrompt()).toContain("memory extraction");
  });
});

describe("buildSpikeChatMessages", () => {
  it("includes prior user and assistant turns before the current user message", () => {
    const result = buildSpikeChatMessages(
      "System",
      [
        { role: "user", content: "Earlier question" },
        { role: "assistant", content: "Earlier answer" },
      ],
      "Latest question",
    );

    expect(result).toEqual([
      { role: "system", content: "System" },
      { role: "user", content: "Earlier question" },
      { role: "assistant", content: "Earlier answer" },
      { role: "user", content: "Latest question" },
    ]);
  });

  it("drops empty content and unsupported history roles", () => {
    const result = buildSpikeChatMessages(
      "System",
      [
        { role: "system", content: "ignore me" },
        { role: "user", content: "   " },
        { role: "assistant", content: "Kept answer" },
      ],
      "Latest question",
    );

    expect(result).toEqual([
      { role: "system", content: "System" },
      { role: "assistant", content: "Kept answer" },
      { role: "user", content: "Latest question" },
    ]);
  });
});

// --- Memory System Tests ---

describe("selectNotes", () => {
  it("filters out low-confidence notes", () => {
    const notes = [
      makeNote({ confidence: 0.1 }),
      makeNote({ confidence: 0.5 }),
      makeNote({ confidence: 0.8 }),
    ];
    const selected = selectNotes(notes);
    expect(selected.length).toBe(2);
    expect(selected.every((n) => n.confidence >= 0.3)).toBe(true);
  });

  it("respects token budget", () => {
    const notes = Array.from({ length: 100 }, (_, i) =>
      makeNote({
        trigger: `trigger-${i}-${"x".repeat(50)}`,
        lesson: `lesson-${i}-${"y".repeat(50)}`,
        confidence: 0.9,
      }),
    );
    const selected = selectNotes(notes, 200);
    // Should select fewer than all 100
    expect(selected.length).toBeLessThan(100);
    expect(selected.length).toBeGreaterThan(0);
  });

  it("returns empty for empty input", () => {
    expect(selectNotes([])).toEqual([]);
  });

  it("sorts by confidence × recency", () => {
    const recent = makeNote({ confidence: 0.6, lastUsedAt: Date.now() });
    const old = makeNote({ confidence: 0.6, lastUsedAt: Date.now() - 365 * 24 * 60 * 60 * 1000 });
    const selected = selectNotes([old, recent]);
    expect(selected[0]).toBe(recent);
  });
});

describe("updateNoteConfidence", () => {
  it("increases confidence when helped", () => {
    const note = makeNote({ confidence: 0.5, helpCount: 0 });
    const updated = updateNoteConfidence(note, true);
    expect(updated.confidence).toBeGreaterThan(0.5);
    expect(updated.helpCount).toBe(1);
  });

  it("decreases confidence when not helped", () => {
    const note = makeNote({ confidence: 0.5 });
    const updated = updateNoteConfidence(note, false);
    expect(updated.confidence).toBeLessThan(0.5);
  });

  it("clamps confidence to [0, 1]", () => {
    const high = makeNote({ confidence: 0.98 });
    const low = makeNote({ confidence: 0.05 });
    expect(updateNoteConfidence(high, true).confidence).toBeLessThanOrEqual(1);
    expect(updateNoteConfidence(low, false).confidence).toBeGreaterThanOrEqual(0);
  });

  it("promotes high-performing notes", () => {
    const note = makeNote({ confidence: 0.65, helpCount: 3 });
    const updated = updateNoteConfidence(note, true);
    // Should get promotion boost beyond just the alpha increment
    expect(updated.confidence).toBeGreaterThan(0.65 + 0.15);
  });
});

describe("pruneNotes", () => {
  it("removes notes below threshold", () => {
    const notes = [
      makeNote({ confidence: 0.1 }),
      makeNote({ confidence: 0.5 }),
      makeNote({ confidence: 0.29 }),
    ];
    const pruned = pruneNotes(notes);
    expect(pruned.length).toBe(1);
    expect(pruned[0].confidence).toBe(0.5);
  });

  it("keeps notes at exactly the threshold", () => {
    const notes = [makeNote({ confidence: 0.3 })];
    expect(pruneNotes(notes).length).toBe(1);
  });
});

describe("parseExtractedNote", () => {
  it("parses valid JSON", () => {
    const result = parseExtractedNote(
      JSON.stringify({ trigger: "coding style", lesson: "prefers functional", confidence: 0.5 }),
    );
    expect(result).toEqual({
      trigger: "coding style",
      lesson: "prefers functional",
      confidence: 0.5,
    });
  });

  it("returns null for 'null' response", () => {
    expect(parseExtractedNote("null")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseExtractedNote("not json")).toBeNull();
  });

  it("returns null for missing fields", () => {
    expect(parseExtractedNote(JSON.stringify({ trigger: "x" }))).toBeNull();
  });

  it("clamps confidence to [0.3, 0.7]", () => {
    const result = parseExtractedNote(
      JSON.stringify({ trigger: "t", lesson: "l", confidence: 0.9 }),
    );
    expect(result?.confidence).toBe(0.7);
  });
});

// --- Helpers ---

function makeNote(overrides: Partial<AetherNote> = {}): AetherNote {
  return {
    id: crypto.randomUUID(),
    trigger: "default trigger",
    lesson: "default lesson",
    confidence: 0.5,
    helpCount: 0,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    ...overrides,
  };
}

import { describe, expect, it } from "vitest";
import { buildZeroShotPrompt, enrichBundle, parseCodeOutput } from "./engine";

describe("codegen engine", () => {
  it("should build a prompt", () => {
    const bundle = {
      id: "b1",
      userId: "u1",
      spec: "Add x",
      fileContents: [{ path: "f1.ts", content: "const a = 1;" }],
      conventions: [],
      constraints: ["No y"],
      examples: [],
      dependencyOutputs: [],
    };
    const prompt = buildZeroShotPrompt(bundle, "Dev", "Format");
    expect(prompt).toContain("Specification: Add x");
    expect(prompt).toContain("--- f1.ts ---");
    expect(prompt).toContain("No y");
  });

  it("should parse fenced blocks", () => {
    const output = "Here is the code:\n```filepath: src/lib/test.ts\nexport const a = 1;\n```";
    const files = parseCodeOutput(output, "fenced");
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("src/lib/test.ts");
    expect(files[0]!.content).toContain("export const a = 1;");
  });

  it("should enrich a bundle", () => {
    const bundle = {
      id: "b1",
      userId: "u1",
      spec: "Add x",
      fileContents: [],
      conventions: [],
      constraints: ["C1"],
      examples: [],
      dependencyOutputs: [],
    };
    const enriched = enrichBundle(bundle, "Add C2");
    expect(enriched.constraints).toContain("C1");
    expect(enriched.constraints).toContain("Correction/Feedback: Add C2");
  });
});

import { describe, expect, it } from "vitest";

import { CODESPACE_SYSTEM_PROMPT, getSystemPromptWithCode } from "./codespace-system";

describe("CODESPACE_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(CODESPACE_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it("mentions Tailwind CSS", () => {
    expect(CODESPACE_SYSTEM_PROMPT).toContain("Tailwind CSS");
  });

  it("mentions React components", () => {
    expect(CODESPACE_SYSTEM_PROMPT).toContain("React");
  });

  it("mentions export default function", () => {
    expect(CODESPACE_SYSTEM_PROMPT).toContain("export default function");
  });

  it("includes shadcn/ui components list", () => {
    expect(CODESPACE_SYSTEM_PROMPT).toContain("@/components/ui/button");
    expect(CODESPACE_SYSTEM_PROMPT).toContain("@/components/ui/card");
  });

  it("includes lucide-react icons list", () => {
    expect(CODESPACE_SYSTEM_PROMPT).toContain("lucide-react");
    expect(CODESPACE_SYSTEM_PROMPT).toContain("ChevronDown");
  });

  it("includes dark mode mandate", () => {
    expect(CODESPACE_SYSTEM_PROMPT).toContain("DARK MODE IS MANDATORY");
  });

  it("includes tool descriptions", () => {
    expect(CODESPACE_SYSTEM_PROMPT).toContain("read_code");
    expect(CODESPACE_SYSTEM_PROMPT).toContain("update_code");
    expect(CODESPACE_SYSTEM_PROMPT).toContain("search_and_replace");
  });
});

describe("getSystemPromptWithCode", () => {
  it("includes the base system prompt", () => {
    const result = getSystemPromptWithCode("const x = 1;");
    expect(result).toContain(CODESPACE_SYSTEM_PROMPT);
  });

  it("includes the provided code", () => {
    const code = "export default function App() { return <div>Hello</div>; }";
    const result = getSystemPromptWithCode(code);
    expect(result).toContain(code);
  });

  it("includes CURRENT CODE section header", () => {
    const result = getSystemPromptWithCode("const x = 1;");
    expect(result).toContain("## CURRENT CODE");
  });

  it("wraps code in tsx code block", () => {
    const result = getSystemPromptWithCode("const x = 1;");
    expect(result).toContain("```tsx");
    expect(result).toContain("const x = 1;");
  });

  it("mentions skip read_code instruction", () => {
    const result = getSystemPromptWithCode("const x = 1;");
    expect(result).toContain("skip read_code");
  });
});

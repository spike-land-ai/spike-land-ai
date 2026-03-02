/**
 * CLAUDE.md Parser
 *
 * Extracts review rules from CLAUDE.md files.
 * Looks for specific sections that define code quality requirements.
 */

export interface ParsedClaudeMdRules {
  codeQualityRules: string[];
  testingRequirements: string[];
  blockingRules: string[];
}

const RULE_SECTION_PATTERNS: [RegExp, RegExp, RegExp] = [
  /#{1,6}\s*(?:code\s*quality|quality)\s*rules/i,
  /#{1,6}\s*(?:testing|test)\s*requirements/i,
  /#{1,6}\s*(?:blocking|critical)/i,
];

export function parseClaudeMd(content: string): ParsedClaudeMdRules {
  const result: ParsedClaudeMdRules = {
    codeQualityRules: [],
    testingRequirements: [],
    blockingRules: [],
  };

  const lines = content.split("\n");
  let currentSection: keyof ParsedClaudeMdRules | null = null;

  for (const line of lines) {
    // Check if this line starts a new relevant section
    if (RULE_SECTION_PATTERNS[0].test(line)) {
      currentSection = "codeQualityRules";
      continue;
    }
    if (RULE_SECTION_PATTERNS[1].test(line)) {
      currentSection = "testingRequirements";
      continue;
    }
    if (RULE_SECTION_PATTERNS[2].test(line)) {
      currentSection = "blockingRules";
      continue;
    }

    // If we hit another heading, stop collecting for current section
    if (/^#+\s/.test(line) && currentSection) {
      currentSection = null;
      continue;
    }

    // Collect bullet points and NEVER/ALWAYS rules
    if (currentSection) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- **NEVER**") || trimmed.startsWith("- **ALWAYS**")) {
        result.blockingRules.push(trimmed.replace(/^-\s*/, ""));
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        result[currentSection].push(trimmed.replace(/^[-*]\s*/, ""));
      }
    }
  }

  return result;
}

export function rulesToPromptLines(rules: ParsedClaudeMdRules): string[] {
  const lines: string[] = [];

  if (rules.blockingRules.length > 0) {
    lines.push("## BLOCKING Rules (from CLAUDE.md)");
    for (const rule of rules.blockingRules) {
      lines.push(`- ${rule}`);
    }
  }

  if (rules.codeQualityRules.length > 0) {
    lines.push("## Code Quality Rules (from CLAUDE.md)");
    for (const rule of rules.codeQualityRules) {
      lines.push(`- ${rule}`);
    }
  }

  if (rules.testingRequirements.length > 0) {
    lines.push("## Testing Requirements (from CLAUDE.md)");
    for (const rule of rules.testingRequirements) {
      lines.push(`- ${rule}`);
    }
  }

  return lines;
}

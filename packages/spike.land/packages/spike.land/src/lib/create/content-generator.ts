import {
  generateStructuredResponse,
  StructuredResponseParseError,
} from "@/lib/ai/gemini-client";
import logger from "@/lib/logger";
import { z } from "zod";

// Re-export everything from the pure prompt-builder module for backward compatibility
export {
  buildSystemPrompt,
  buildUserPrompt,
  extractKeywords,
  getMatchedSkills,
  LUCIDE_ICONS,
  matchesAny,
  SYSTEM_PROMPT,
} from "./prompt-builder";
export type { MatchedSkill, Skill, SkillCategory } from "./prompt-builder";

// Import what we need internally
import {
  buildSystemPrompt,
  buildUserPrompt,
  LUCIDE_ICONS,
} from "./prompt-builder";

const GeneratedAppSchema = z.object({
  plan: z.string().optional().describe(
    "Optional 1-2 sentence architecture plan before writing code",
  ),
  title: z.string().describe("The name of the app"),
  description: z.string().describe(
    "A concise 1-sentence description of what the app does",
  ),
  code: z.string().describe(
    "The complete, self-contained React component code (using Tailwind CSS)",
  ),
  relatedApps: z.array(z.string()).describe(
    "List of 3-5 related app paths that user might want to try next (e.g. 'cooking/french', 'games/tic-tac-toe')",
  ),
});

export type GeneratedAppContent = Omit<
  z.infer<typeof GeneratedAppSchema>,
  "plan"
>;

export type GenerationResult = {
  content: GeneratedAppContent | null;
  rawCode: string | null;
  error: string | null;
};

function pruneUnusedIcons(code: string): string {
  // 1. Identify Lucide icon imports
  const lucideImportRegex = /import\s*{([^}]+)}\s*from\s*["']lucide-react["'];?/g;
  let match;
  const importsToReplace: Array<{ fullMatch: string; icons: string[]; }> = [];

  while ((match = lucideImportRegex.exec(code)) !== null) {
    const importContent = match[1];
    if (importContent) {
      const icons = importContent.split(",").map(i => i.trim()).filter(
        Boolean,
      );
      importsToReplace.push({ fullMatch: match[0], icons });
    }
  }

  if (importsToReplace.length === 0) return code;

  let prunedCode = code;

  for (const { fullMatch, icons } of importsToReplace) {
    // 2. For each icon in this import, check if it's used elsewhere in the code
    // We remove the import itself from the code search to avoid self-matches
    const codeWithoutCurrentImport = prunedCode.replace(fullMatch, "");

    const usedIcons = icons.filter(icon => {
      // Look for the icon name as a whole word (e.g., <Plus, Plus., Plus )
      const usageRegex = new RegExp(`\\b${icon}\\b`, "g");
      return usageRegex.test(codeWithoutCurrentImport);
    });

    if (usedIcons.length === 0) {
      // No icons from this import are used — remove the whole line
      prunedCode = prunedCode.replace(fullMatch, "");
    } else {
      // Rewrite the import line to prune unused icons AND normalize to double quotes
      const newImport = `import { ${usedIcons.join(", ")} } from "lucide-react";`;
      prunedCode = prunedCode.replace(fullMatch, newImport);
    }
  }

  return prunedCode.trim();
}

function addMissingIconImports(code: string): string {
  // Find all lucide icons used in JSX: <IconName
  const jsxUsagePattern = /<([A-Z][A-Za-z0-9]*)/g;
  const usedIcons = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = jsxUsagePattern.exec(code)) !== null) {
    if (LUCIDE_ICONS.has(m[1]!)) usedIcons.add(m[1]!);
  }
  if (usedIcons.size === 0) return code;

  // Find existing lucide-react import and extract already-imported names
  const importPattern = /^(import\s*\{([^}]*)\}\s*from\s*["']lucide-react["'];?)$/m;
  const existing = importPattern.exec(code);
  const alreadyImported = new Set<string>();
  if (existing) {
    for (const spec of existing[2]!.split(",")) {
      const name = spec.trim().split(/\s+as\s+/)[0]!.trim();
      if (name) alreadyImported.add(name);
    }
  }

  const missing = [...usedIcons].filter(i => !alreadyImported.has(i)).sort();
  if (missing.length === 0) return code;

  if (existing) {
    // Merge missing icons into existing import
    const original = existing[2]!.trim().replace(/,\s*$/, "");
    const merged = original
      ? `${original}, ${missing.join(", ")}`
      : missing.join(", ");
    return code.replace(
      existing[0],
      `import { ${merged} } from "lucide-react";`,
    );
  }

  // No existing import — insert after last import statement
  const lastImportPattern = /^import\s.+$/gm;
  let lastIdx = -1;
  let lastLen = 0;
  while ((m = lastImportPattern.exec(code)) !== null) {
    lastIdx = m.index;
    lastLen = m[0].length;
  }
  const newImport = `import { ${missing.join(", ")} } from "lucide-react";`;
  if (lastIdx !== -1) {
    const pos = lastIdx + lastLen;
    return code.slice(0, pos) + "\n" + newImport + code.slice(pos);
  }
  return newImport + "\n" + code;
}

export function cleanCode(code: string): string {
  const cleaned = code
    .replace(/^\s*```(?:tsx|typescript|jsx|javascript|ts|js)?\s*\n?/, "")
    .replace(/\n?\s*```\s*$/, "")
    .trim();
  // First add missing imports, then prune unused — order matters
  return pruneUnusedIcons(addMissingIconImports(cleaned));
}

export function extractCodeFromRawText(text: string): string | null {
  // Try to extract the "code" field value from malformed JSON
  const codeMatch = text.match(/"code"\s*:\s*"([\s\S]+)/);
  if (!codeMatch?.[1]) return null;

  let code = codeMatch[1];

  // Remove trailing JSON artifacts (closing field patterns)
  code = code.replace(
    /"\s*,?\s*"(relatedApps|title|description)"\s*:[\s\S]*$/,
    "",
  );
  code = code.replace(/"\s*,?\s*}\s*$/, "");
  code = code.replace(/"\s*$/, "");

  // Unescape JSON string escapes
  try {
    code = JSON.parse(`"${code}"`);
  } catch {
    code = code.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }

  code = cleanCode(code);
  return code || null;
}

export async function attemptCodeCorrection(
  code: string,
  error: string,
  topic: string,
): Promise<string | null> {
  try {
    logger.info("Attempting code correction", {
      topic,
      error: error.slice(0, 200),
    });

    const result = await generateStructuredResponse<{ code: string; }>({
      prompt: `The following React component failed transpilation with this error:

ERROR: ${error}

ORIGINAL CODE:
\`\`\`tsx
${code}
\`\`\`

Fix the code so it transpiles successfully. Return JSON: { "code": "<fixed code>" }
- Only fix the transpilation error, do not redesign the component
- Preserve all existing functionality
- code must be a raw string (no markdown fences)`,
      systemPrompt:
        "You are a React/TypeScript expert. Fix the transpilation error in the code. Return only the corrected code in JSON format.",
      maxTokens: 16384,
      temperature: 0.2,
      thinkingBudget: 4096,
    });

    if (result && typeof result.code === "string") {
      const corrected = cleanCode(result.code);
      logger.info("Code correction produced result", {
        topic,
        codeLength: corrected.length,
      });
      return corrected || null;
    }

    return null;
  } catch (err) {
    logger.error("Code correction failed", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return null;
  }
}

export async function generateAppContent(
  path: string[],
): Promise<GenerationResult> {
  const topic = path.join("/");

  try {
    const result = await generateStructuredResponse<GeneratedAppContent>({
      prompt: buildUserPrompt(topic),
      systemPrompt: buildSystemPrompt(topic),
      maxTokens: 32768,
      temperature: 0.5,
      thinkingBudget: 32768,
      responseJsonSchema: {
        type: "object",
        properties: {
          plan: { type: "string", nullable: true },
          title: { type: "string" },
          description: { type: "string" },
          code: { type: "string" },
          relatedApps: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "code", "relatedApps"],
      },
    });

    // Extract rawCode before validation so it's available even if other fields fail
    const resultObj = result as Record<string, unknown> | null;
    const rawCode = resultObj && typeof resultObj === "object" && "code" in resultObj
        && typeof resultObj.code === "string"
      ? cleanCode(resultObj.code)
      : null;

    // Clean the code field in-place for validation
    if (result && result.code) {
      result.code = cleanCode(result.code);
    }

    const parsed = GeneratedAppSchema.safeParse(result);
    if (parsed.success) {
      const { plan, ...content } = parsed.data;
      if (plan) {
        logger.info("Generated app plan", { topic, plan });
      }
      return { content, rawCode: content.code, error: null };
    }

    // Validation failed but we may have raw code
    const errorMsg = parsed.error.issues.map(i => i.message).join(", ");
    logger.warn(
      "Generated content failed validation, attempting correction...",
      {
        error: errorMsg,
      },
    );

    if (rawCode) {
      const correctedCode = await attemptCodeCorrection(
        rawCode,
        errorMsg,
        topic,
      );
      if (correctedCode) {
        logger.info("Correction successful, returning fixed code");
        // If we have other valid fields from the initial parse (even if partial), use them
        // verification: we know parsing failed, but maybe we can salvage title/desc if they were valid?
        // For safe fallback, we use the original result properties if they exist and are strings
        const safeTitle = resultObj && typeof resultObj.title === "string"
          ? resultObj.title
          : topic.split("/").pop() || "App";
        const safeDesc = resultObj && typeof resultObj.description === "string"
          ? resultObj.description
          : "Generated application";
        const safeRelated = resultObj && Array.isArray(resultObj.relatedApps)
          ? resultObj.relatedApps
          : [];

        return {
          content: {
            title: safeTitle,
            description: safeDesc,
            code: correctedCode,
            relatedApps: safeRelated as string[],
          },
          rawCode: correctedCode,
          error: null,
        };
      }
    }

    return { content: null, rawCode, error: errorMsg };
  } catch (error) {
    logger.error("Failed to generate app content:", { error });
    const message = error instanceof Error ? error.message : "Unknown error";

    let rawCode: string | null = null;
    if (error instanceof StructuredResponseParseError) {
      rawCode = extractCodeFromRawText(error.rawText);

      // Attempt correction on parse errors too if we successfully extracted code
      if (rawCode) {
        logger.warn("Attempting correction on content with parse error...");
        const correctedCode = await attemptCodeCorrection(
          rawCode,
          `JSON Parse Error: ${message}`,
          topic,
        );

        if (correctedCode) {
          // Since we failed to parse the JSON, we don't have title/desc.
          // We'll return the code and synthesized metadata.
          return {
            content: {
              title: topic.split("/").pop() || "Generated App",
              description: "Automatically corrected application",
              code: correctedCode,
              relatedApps: [],
            },
            rawCode: correctedCode,
            error: null,
          };
        }
      }
    }

    return { content: null, rawCode, error: message };
  }
}

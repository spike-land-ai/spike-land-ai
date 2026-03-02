import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages.js";
import {
  AGENT_IDENTITY,
  buildSystemPrompt as buildSkillSystemPrompt,
  buildUserPrompt as buildSkillUserPrompt,
  OUTPUT_SPEC,
} from "./prompt-builder";

// Re-export for any consumers that import from here
export { AGENT_IDENTITY, OUTPUT_SPEC } from "./prompt-builder";

// Layer 5: Fix output specification — stable (cacheable)
const FIX_OUTPUT_SPEC = `## OUTPUT FORMAT
Respond with ONLY the fixed React component code.
Do NOT wrap it in markdown fences or JSON. Just the raw TypeScript/JSX code.

RULES:
- Only fix the specific error mentioned
- Do NOT redesign or restructure the component
- Preserve all existing functionality
- Ensure all imports are correct`;

export interface LearningNote {
  id: string;
  trigger: string;
  lesson: string;
  confidenceScore: number;
}

export interface SplitPrompt {
  full: string;
  stablePrefix: string;
  dynamicSuffix: string;
}

/**
 * Build the full system prompt for generation.
 *
 * Returns split blocks for optimal KV cache hit rates:
 * - `stablePrefix` (identity + core prompt + skills + output spec) → cached
 * - `dynamicSuffix` (learning notes) → NOT cached, changes per request
 * - `full` — concatenated version for backwards compatibility
 */
export function buildAgentSystemPrompt(topic: string, notes: LearningNote[]): SplitPrompt {
  // Stable prefix: layers 1, 3, 5 (identity + core + output spec)
  const coreWithSkills = buildSkillSystemPrompt(topic);
  const stablePrefix = `${AGENT_IDENTITY}\n\n${coreWithSkills}\n\n${OUTPUT_SPEC}`;

  // Dynamic suffix: layers 2, 4 (learning notes)
  const noteBlock = formatNotes(notes);

  return {
    stablePrefix,
    dynamicSuffix: noteBlock,
    full: noteBlock ? `${stablePrefix}\n\n${noteBlock}` : stablePrefix,
  };
}

/**
 * Build the user prompt for generation.
 * Returns a plain string when no images are provided, or an array of content
 * blocks for multimodal messages when images are attached.
 */
export function buildAgentUserPrompt(
  path: string[],
  imageUrls?: string[],
): string | ContentBlockParam[] {
  const topic = path.join("/");
  const textPrompt = buildSkillUserPrompt(topic);

  if (!imageUrls || imageUrls.length === 0) {
    return textPrompt;
  }

  // Return content blocks array for multimodal message
  const blocks: ContentBlockParam[] = [{ type: "text", text: textPrompt }];

  for (const url of imageUrls) {
    blocks.push({
      type: "image",
      source: { type: "url", url },
    });
  }

  blocks.push({
    type: "text",
    text: "The user has attached the above reference image(s). Use them as visual inspiration for the app's design, layout, color scheme, or content as appropriate.",
  });

  return blocks;
}

// Lightweight fix prompt — doesn't need the full skill catalogue, icon lists, or layout patterns
const FIX_CORE_PROMPT = `You are an expert React/TypeScript debugger for spike.land's app creator.
Your ONLY job is to fix transpilation errors in React components. Do NOT redesign or restructure.

## ENVIRONMENT
- React 19, Tailwind CSS 4, shadcn/ui components available
- npm packages load from CDN automatically
- Component must have exactly one default export
- Available: framer-motion, lucide-react, date-fns, recharts, zustand, sonner

## FIX STRATEGY
1. Read the ERROR TYPE and LINE NUMBER carefully
2. Identify the root cause (missing import, wrong syntax, type mismatch)
3. Apply the MINIMAL fix — do not rewrite unrelated code
4. Verify all imports are correct after fixing`;

/**
 * Build the system prompt for fix attempts.
 * Uses a lightweight prompt focused on debugging — no full skill catalogue.
 * Returns split blocks for cache optimization.
 */
export function buildFixSystemPrompt(_topic: string, notes: LearningNote[]): SplitPrompt {
  const noteBlock = formatNotes(notes);
  const stablePrefix = `${FIX_CORE_PROMPT}\n\n${FIX_OUTPUT_SPEC}`;

  return {
    stablePrefix,
    dynamicSuffix: noteBlock,
    full: noteBlock ? `${stablePrefix}\n\n${noteBlock}` : stablePrefix,
  };
}

export interface StructuredErrorContext {
  type: string;
  library?: string;
  lineNumber?: number;
  suggestion?: string;
}

/**
 * Build the user prompt for fix attempts.
 * Includes structured error context, the failing code, error message, and history.
 */
export function buildFixUserPrompt(
  code: string,
  error: string,
  previousErrors: Array<{ error: string; iteration: number }>,
  structuredError?: StructuredErrorContext,
): string {
  const historyBlock =
    previousErrors.length > 0
      ? `\n\nPrevious errors in this session:\n${previousErrors
          .map((e) => `- Attempt ${e.iteration + 1}: ${e.error.slice(0, 200)}`)
          .join("\n")}`
      : "";

  // Add structured error context when available for more precise fixing
  const structuredBlock = structuredError
    ? `\nERROR TYPE: ${structuredError.type}${
        structuredError.library ? `\nLIBRARY: ${structuredError.library}` : ""
      }${structuredError.lineNumber ? `\nLINE: ${structuredError.lineNumber}` : ""}${
        structuredError.suggestion ? `\nSUGGESTION: ${structuredError.suggestion}` : ""
      }\n`
    : "";

  return `The following React component failed transpilation. Fix it.
${structuredBlock}
ERROR: ${error}
${historyBlock}

CURRENT CODE:
${code}

Return ONLY the fixed code. No explanations, no markdown fences.`;
}

/** Rough token estimate: ~3.5 chars per token for English text. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

const NOTE_TOKEN_BUDGET = 800;

/**
 * Format learning notes for inclusion in the system prompt.
 * Sorted by confidence score, selected greedily within an ~800 token budget.
 */
function formatNotes(notes: LearningNote[]): string {
  if (notes.length === 0) return "";

  const sorted = [...notes].sort((a, b) => b.confidenceScore - a.confidenceScore);

  // Greedy token-budget selection instead of hard count cap
  const selected: LearningNote[] = [];
  let totalTokens = 0;
  for (const note of sorted) {
    const noteText = `- **${note.trigger}**: ${note.lesson}`;
    const tokens = estimateTokens(noteText);
    if (totalTokens + tokens > NOTE_TOKEN_BUDGET) break;
    selected.push(note);
    totalTokens += tokens;
  }

  if (selected.length === 0) return "";

  return `## Lessons Learned (from previous generations)
Apply these lessons to avoid known issues:

${selected.map((n) => `- **${n.trigger}**: ${n.lesson}`).join("\n")}`;
}

/**
 * System prompt for extracting learning notes from error/fix pairs.
 * Used with Claude Haiku for cost efficiency.
 */
export const NOTE_EXTRACTION_PROMPT = `You extract structured learning notes from code errors and their fixes.
Given an error and the code that caused it (plus optionally the fix), produce a JSON object:

{
  "trigger": "short phrase describing when this note applies (e.g., 'framer-motion AnimatePresence')",
  "triggerType": "library" | "pattern" | "error_class" | "component_type",
  "lesson": "concise actionable instruction (e.g., 'Always wrap children in motion.div with exit prop')",
  "libraries": ["library1", "library2"],
  "errorPatterns": ["key error substring"],
  "tags": ["relevant", "tags"]
}

Rules:
- trigger should be 2-5 words, specific enough to match relevant future generations
- lesson should be a direct instruction, under 100 characters
- libraries should list npm package names involved
- errorPatterns should contain distinctive substrings from the error message
- tags should be broad categories (e.g., "animation", "layout", "imports", "types")
- If the error is too generic or not useful as a lesson, respond with: { "skip": true }`;

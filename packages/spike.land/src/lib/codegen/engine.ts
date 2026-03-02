import type { ContextBundle } from "./types";

export function buildZeroShotPrompt(bundle: ContextBundle, role: string, format: string): string {
  let prompt = `Role: ${role}\nFormat: ${format}\n\n`;
  prompt += `Specification: ${bundle.spec}\n\n`;

  if (bundle.fileContents.length > 0) {
    prompt += `Existing Context Files:\n`;
    for (const file of bundle.fileContents) {
      prompt += `--- ${file.path} ---\n${file.content}\n\n`;
    }
  }

  if (bundle.constraints.length > 0) {
    prompt += `Constraints:\n- ${bundle.constraints.join("\n- ")}\n\n`;
  }

  return prompt;
}

export function parseCodeOutput(
  rawOutput: string,
  _format: string,
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];

  // Basic fenced block parsing
  const regex = /```(?:[\w.]+)?\s*(?:filepath:\s*([\w/.-]+))?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(rawOutput)) !== null) {
    const path = match[1] || "unknown_file";
    const content = match[2] ?? "";
    files.push({ path, content });
  }

  if (files.length === 0 && rawOutput.includes("---")) {
    // Fallback for manual separator
    const segments = rawOutput.split(/--- ([\w/.-]+) ---/);
    for (let i = 1; i < segments.length; i += 2) {
      files.push({
        path: segments[i] ?? "unknown_file",
        content: (segments[i + 1] ?? "").trim(),
      });
    }
  }

  return files;
}

export function enrichBundle(bundle: ContextBundle, feedback: string): ContextBundle {
  return {
    ...bundle,
    constraints: [...bundle.constraints, `Correction/Feedback: ${feedback}`],
  };
}

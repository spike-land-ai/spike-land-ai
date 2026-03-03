import { getOrCreateSession, upsertSession } from "@/lib/codespace";
import { transpileCode } from "@/lib/codespace/transpile";
import logger from "@/lib/logger";
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

/**
 * Regex pattern for valid codespace IDs
 * Must start with lowercase letter/number, contain only lowercase letters, numbers, hyphens, and dots
 * Note: Dots are allowed for word-separated IDs like "vibrant.wave.snap.kqii"
 */
const CODESPACE_ID_REGEX = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

/**
 * Validates a codespace ID to prevent SSRF attacks
 * @param id - The codespace ID to validate
 * @returns true if valid, false otherwise
 */
function isValidCodespaceId(id: string): boolean {
  return (
    typeof id === "string"
    && id.length > 0
    && id.length <= 100
    && !id.includes("..")
    && !id.includes("/")
    && !id.includes("\\")
    && CODESPACE_ID_REGEX.test(id)
  );
}

/**
 * Structured validation error from the backend
 */
interface ValidationError {
  line?: number;
  column?: number;
  message: string;
}

/**
 * Format validation errors into a human-readable string for the agent
 */
function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return "Unknown validation error";

  return errors
    .map(e => {
      const location = e.line
        ? `Line ${e.line}${e.column ? `:${e.column}` : ""}: `
        : "";
      return `${location}${e.message}`;
    })
    .join("\n");
}

/**
 * Read the current code from the codespace via direct DB access
 */
async function readCode(codespaceId: string): Promise<string> {
  logger.info(`[codespace-tools] readCode called for: ${codespaceId}`);

  try {
    const session = await getOrCreateSession(codespaceId);
    const code = session.code || "";
    logger.info(
      `[codespace-tools] readCode success, code length: ${code.length}`,
    );
    return code;
  } catch (error) {
    const msg = `Error reading code: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(`[codespace-tools] ${msg}`);
    return msg;
  }
}

/**
 * Update the entire code via direct DB access + transpilation
 * Returns "success" on success, or a formatted error message on failure
 */
async function updateCode(
  codespaceId: string,
  code: string,
): Promise<string> {
  logger.info(`[codespace-tools] updateCode called for: ${codespaceId}`);
  logger.info(`[codespace-tools] updateCode code length: ${code.length}`);

  try {
    // Transpile the code
    let transpiled: string;
    try {
      transpiled = await transpileCode(code, "https://spike.land");
    } catch (error) {
      // Parse transpilation errors
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[codespace-tools] Transpilation failed: ${errorMsg}`);

      // Try to extract structured errors
      try {
        const parsed = JSON.parse(errorMsg);
        if (Array.isArray(parsed.errors)) {
          const formattedErrors = formatValidationErrors(parsed.errors);
          return `TypeScript/JSX errors found:\n${formattedErrors}\n\nPlease fix these errors and try again.`;
        }
      } catch {
        // Not JSON, return raw error
      }

      return `TypeScript/JSX errors found:\n${errorMsg}\n\nPlease fix these errors and try again.`;
    }

    // Save to DB
    await upsertSession({
      codeSpace: codespaceId,
      code,
      transpiled,
      html: "",
      css: "",
      messages: [],
    });

    logger.info(`[codespace-tools] updateCode SUCCESS for: ${codespaceId}`);
    return "success";
  } catch (error) {
    const msg = `Error updating code: ${error instanceof Error ? error.message : String(error)}`;
    logger.error(`[codespace-tools] ${msg}`);
    return msg;
  }
}

/**
 * Edit specific lines of code
 */
async function editCode(
  codespaceId: string,
  edits: Array<{ startLine: number; endLine: number; content: string; }>,
): Promise<string> {
  logger.info(`[codespace-tools] editCode called for: ${codespaceId}`);
  logger.info(`[codespace-tools] editCode edits:`, { edits });

  // First read the current code
  const currentCode = await readCode(codespaceId);
  if (
    currentCode.startsWith("Error")
  ) {
    return currentCode;
  }

  const lines = currentCode.split("\n");

  // Sort edits by startLine descending to avoid line number shifting issues
  const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

  for (const edit of sortedEdits) {
    const { startLine, endLine, content } = edit;
    // Convert to 0-based index
    const start = startLine - 1;
    const end = endLine;
    // Replace the lines
    const newLines = content.split("\n");
    lines.splice(start, end - start, ...newLines);
  }

  const newCode = lines.join("\n");
  logger.info(
    `[codespace-tools] editCode resulting code length: ${newCode.length}`,
  );
  return updateCode(codespaceId, newCode);
}

/**
 * Search and replace in code
 */
async function searchAndReplace(
  codespaceId: string,
  search: string,
  replace: string,
  isRegex?: boolean,
): Promise<string> {
  logger.info(`[codespace-tools] searchAndReplace called for: ${codespaceId}`);
  logger.info(
    `[codespace-tools] searchAndReplace search: "${search.substring(0, 50)}${
      search.length > 50 ? "..." : ""
    }"`,
  );
  logger.info(
    `[codespace-tools] searchAndReplace replace: "${replace.substring(0, 50)}${
      replace.length > 50 ? "..." : ""
    }"`,
  );
  logger.info(`[codespace-tools] searchAndReplace isRegex: ${isRegex}`);

  const currentCode = await readCode(codespaceId);
  if (
    currentCode.startsWith("Error")
  ) {
    return currentCode;
  }

  let newCode: string;
  if (isRegex) {
    const regex = new RegExp(search, "g");
    newCode = currentCode.replace(regex, replace);
  } else {
    // Replace all occurrences of the literal string
    newCode = currentCode.split(search).join(replace);
  }

  if (newCode === currentCode) {
    logger.info(`[codespace-tools] searchAndReplace: No matches found`);
    return "No matches found for the search pattern";
  }

  logger.info(
    `[codespace-tools] searchAndReplace: Found matches, updating code`,
  );
  return updateCode(codespaceId, newCode);
}

/**
 * Validate code without updating the session
 * Returns validation errors if any, or "valid" if the code is valid
 */
async function validateCode(
  codespaceId: string,
  code: string,
): Promise<string> {
  logger.info(`[codespace-tools] validateCode called for: ${codespaceId}`);
  logger.info(`[codespace-tools] validateCode code length: ${code.length}`);

  try {
    // Try to transpile — if it succeeds, the code is valid
    await transpileCode(code, "https://spike.land");
    logger.info(`[codespace-tools] validateCode: code is valid`);
    return "valid";
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Try to extract structured errors
    try {
      const parsed = JSON.parse(errorMsg);
      if (Array.isArray(parsed.errors)) {
        const formattedErrors = formatValidationErrors(parsed.errors);
        logger.info(
          `[codespace-tools] validateCode: found errors:\n${formattedErrors}`,
        );
        return `TypeScript/JSX errors:\n${formattedErrors}`;
      }
    } catch {
      // Not JSON
    }

    logger.info(`[codespace-tools] validateCode: found errors:\n${errorMsg}`);
    return `TypeScript/JSX errors:\n${errorMsg}`;
  }
}

/**
 * Find lines matching a pattern
 */
async function findLines(
  codespaceId: string,
  search: string,
): Promise<string> {
  logger.info(`[codespace-tools] findLines called for: ${codespaceId}`);
  logger.info(`[codespace-tools] findLines search: "${search}"`);

  const currentCode = await readCode(codespaceId);
  if (
    currentCode.startsWith("Error")
  ) {
    return currentCode;
  }

  const lines = currentCode.split("\n");
  const matches: Array<{ line: number; content: string; }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.includes(search)) {
      matches.push({ line: i + 1, content: line });
    }
  }

  logger.info(`[codespace-tools] findLines: Found ${matches.length} matches`);

  if (matches.length === 0) {
    return "No matches found";
  }

  return matches
    .map(m => `Line ${m.line}: ${m.content}`)
    .join("\n");
}

/**
 * Create an MCP server with codespace tools for the given codespaceId
 */
export function createCodespaceServer(codespaceId: string) {
  // Validate codespaceId to prevent SSRF attacks
  if (!isValidCodespaceId(codespaceId)) {
    logger.error(
      `[codespace-tools] Invalid codespaceId rejected: ${codespaceId}`,
    );
    throw new Error(`Invalid codespace ID format: ${codespaceId}`);
  }

  logger.info(
    `[codespace-tools] Creating MCP server for codespace: ${codespaceId}`,
  );
  logger.info(
    `[codespace-tools] Available tools: ${CODESPACE_TOOL_NAMES.join(", ")}`,
  );

  return createSdkMcpServer({
    name: "codespace",
    version: "1.0.0",
    tools: [
      tool(
        "read_code",
        "Read the current code from the codespace. ALWAYS use this before making any changes to understand the current state.",
        {},
        async () => {
          const result = await readCode(codespaceId);
          return { content: [{ type: "text", text: result }] };
        },
      ),
      tool(
        "update_code",
        "Replace the ENTIRE code content of the file. Use this for major rewrites or when search_and_replace is too complex.",
        { code: z.string().describe("The full new code content for the file") },
        async args => {
          const result = await updateCode(codespaceId, args.code);
          return { content: [{ type: "text", text: result }] };
        },
      ),
      tool(
        "edit_code",
        "Edit specific lines of code. Use this for targeted changes when you know the line numbers.",
        {
          edits: z.array(
            z.object({
              startLine: z.number().describe(
                "1-based line number to start editing from",
              ),
              endLine: z.number().describe(
                "1-based line number to end editing at (inclusive)",
              ),
              content: z.string().describe(
                "New content to replace the lines with",
              ),
            }),
          ).describe("List of edits to apply"),
        },
        async args => {
          const result = await editCode(codespaceId, args.edits);
          return { content: [{ type: "text", text: result }] };
        },
      ),
      tool(
        "search_and_replace",
        "Search for a pattern and replace it. Best for small, precise changes like renaming variables or changing colors.",
        {
          search: z.string().describe(
            "The string or regex pattern to search for",
          ),
          replace: z.string().describe("The string to replace the match with"),
          isRegex: z.boolean().optional().describe(
            "Whether the search pattern is a regex",
          ),
        },
        async args => {
          const result = await searchAndReplace(
            codespaceId,
            args.search,
            args.replace,
            args.isRegex,
          );
          return { content: [{ type: "text", text: result }] };
        },
      ),
      tool(
        "find_lines",
        "Find line numbers matching a pattern. Use this to locate code before using edit_code.",
        { search: z.string().describe("The string pattern to search for") },
        async args => {
          const result = await findLines(codespaceId, args.search);
          return { content: [{ type: "text", text: result }] };
        },
      ),
      tool(
        "validate_code",
        "Validate code without updating the codespace. Use this to check for TypeScript/JSX errors before making changes. Returns 'valid' if code is valid, or detailed error messages with line numbers.",
        { code: z.string().describe("The code to validate") },
        async args => {
          const result = await validateCode(codespaceId, args.code);
          return { content: [{ type: "text", text: result }] };
        },
      ),
    ],
  });
}

/**
 * Tool names in the format expected by allowedTools option
 */
export const CODESPACE_TOOL_NAMES = [
  "mcp__codespace__read_code",
  "mcp__codespace__update_code",
  "mcp__codespace__edit_code",
  "mcp__codespace__search_and_replace",
  "mcp__codespace__find_lines",
  "mcp__codespace__validate_code",
];

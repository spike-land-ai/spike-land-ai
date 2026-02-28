export interface StructuredError {
  type: "transpile" | "runtime" | "type" | "import" | "unknown";
  message: string;
  library?: string;
  component?: string;
  lineNumber?: number;
  suggestion?: string;
  severity: "fixable" | "structural" | "environmental";
  fixStrategy: "patch" | "rewrite-section" | "regenerate";
}

/**
 * Parse a raw transpilation error string into a structured format.
 * Used for better note matching and more informative fix prompts.
 */
export function parseTranspileError(rawError: string): StructuredError {
  const error: StructuredError = {
    type: "unknown",
    message: rawError.slice(0, 500),
    severity: "fixable",
    fixStrategy: "patch",
  };

  // Missing import / module not found
  if (
    /(?:Cannot find module|Could not resolve|Module not found|is not exported from)/i
      .test(rawError)
  ) {
    error.type = "import";
    const moduleMatch = rawError.match(/['"]([^'"]+)['"]/);
    if (moduleMatch?.[1] !== undefined) {
      error.library = moduleMatch[1];
    }
  } // Type errors
  else if (
    /(?:Type '.*' is not assignable|Property '.*' does not exist|Expected \d+ arguments)/i
      .test(rawError)
  ) {
    error.type = "type";
  } // JSX/syntax errors
  else if (
    /(?:Unexpected token|Unterminated|Expected|Parse error)/i.test(rawError)
  ) {
    error.type = "transpile";
  } // Undefined variable / runtime errors
  else if (
    /(?:is not defined|Cannot read propert)/i.test(rawError)
  ) {
    error.type = "runtime";
    const varMatch = rawError.match(/['"]?(\w+)['"]?\s+is not defined/);
    if (varMatch?.[1] !== undefined) {
      error.component = varMatch[1];
    }
  }

  // Extract line number
  const lineMatch = rawError.match(/(?:line\s+|:)(\d+)(?:[:\s]|$)/i);
  if (lineMatch) {
    error.lineNumber = parseInt(lineMatch[1]!, 10);
  }

  // Extract component name from JSX context
  const compMatch = rawError.match(/<(\w+)/);
  if (compMatch?.[1] !== undefined && !error.component) {
    error.component = compMatch[1];
  }

  // Extract suggestion if error message contains one
  const sugMatch = rawError.match(
    /(?:Did you mean|Try|Suggestion|Consider)[:\s]+(.+?)(?:\.|$)/i,
  );
  if (sugMatch) {
    error.suggestion = sugMatch[1]!.trim();
  }

  // Determine severity and fix strategy based on error type and context
  const { severity, fixStrategy } = classifyErrorSeverity(error);
  error.severity = severity;
  error.fixStrategy = fixStrategy;

  return error;
}

/** Known libraries available on the CDN at esm.sh. */
const KNOWN_CDN_LIBRARIES = new Set([
  "react",
  "react-dom",
  "framer-motion",
  "lucide-react",
  "date-fns",
  "zustand",
  "sonner",
  "recharts",
  "react-hook-form",
  "zod",
  "react-markdown",
  "canvas-confetti",
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "roughjs",
  "howler",
  "three",
  "clsx",
  "tailwind-merge",
]);

/**
 * Classify error severity and determine the appropriate fix strategy.
 */
function classifyErrorSeverity(error: StructuredError): {
  severity: StructuredError["severity"];
  fixStrategy: StructuredError["fixStrategy"];
} {
  switch (error.type) {
    case "import":
      // Environmental: library doesn't exist on CDN — no point patching
      if (
        error.library && !error.library.startsWith("@/")
        && !KNOWN_CDN_LIBRARIES.has(error.library)
      ) {
        return { severity: "environmental", fixStrategy: "regenerate" };
      }
      // Fixable: wrong import path or missing import
      return { severity: "fixable", fixStrategy: "patch" };

    case "type":
      return { severity: "fixable", fixStrategy: "patch" };

    case "transpile":
      return { severity: "fixable", fixStrategy: "patch" };

    case "runtime":
      // If a component/variable is not defined, it may be structural
      if (error.component) {
        return { severity: "structural", fixStrategy: "rewrite-section" };
      }
      return { severity: "fixable", fixStrategy: "patch" };

    default:
      return { severity: "fixable", fixStrategy: "patch" };
  }
}

/**
 * Check if an error is unrecoverable and the fix loop should terminate early.
 * Returns true for: (a) import errors for unknown CDN packages,
 * (b) 2+ identical errors in succession.
 */
export function isUnrecoverableError(
  error: StructuredError,
  previousErrors: Array<{ error: string; }>,
): boolean {
  // Environmental errors: unknown library not on CDN
  if (error.severity === "environmental") {
    return true;
  }

  // Repeated identical errors: 2+ consecutive identical errors means the fix isn't working
  if (previousErrors.length >= 2) {
    const last = previousErrors[previousErrors.length - 1]!.error;
    const secondToLast = previousErrors[previousErrors.length - 2]!.error;
    if (last === secondToLast) {
      return true;
    }
  }

  return false;
}

/**
 * Categorize an error for note creation — determines triggerType and tags.
 */
export function categorizeErrorForNote(error: StructuredError): {
  triggerType: string;
  tags: string[];
} {
  switch (error.type) {
    case "import":
      return {
        triggerType: "library",
        tags: ["imports", error.library || "unknown"].filter(Boolean),
      };
    case "type":
      return {
        triggerType: "pattern",
        tags: ["types", "typescript"],
      };
    case "transpile":
      return {
        triggerType: "error_class",
        tags: ["syntax", "transpile"],
      };
    case "runtime":
      return {
        triggerType: "pattern",
        tags: ["runtime", error.component || "unknown"].filter(Boolean),
      };
    default:
      return {
        triggerType: "error_class",
        tags: ["unknown"],
      };
  }
}

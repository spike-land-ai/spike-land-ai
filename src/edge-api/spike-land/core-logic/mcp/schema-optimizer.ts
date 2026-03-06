/**
 * Schema Optimizer
 *
 * Minimizes JSON Schema size by stripping redundant information:
 * - Descriptions that match the property name (case-insensitive)
 * - Default values that are undefined
 * - Empty objects/arrays that add no information
 * - Type-obvious descriptions ("A string", "A boolean", etc.)
 * - "Optional X" / "Required X" prefixes (redundant with required array)
 * - title fields that match the property name
 * - Empty required arrays (required: [])
 * - additionalProperties: true (JSON Schema default)
 * - type: "object" at root level (root schemas are always objects)
 */

/**
 * Optimize a JSON Schema object by removing redundant information.
 * Returns a new object (does not mutate the input).
 */
export function optimizeSchema(schema: object): object {
  return optimizeNode(schema, undefined, true) as object;
}

/**
 * Inject tool examples into a JSON Schema object.
 * Adds an `examples` array at the root level following the JSON Schema spec.
 * Only includes the input objects from ToolExample[], not names/descriptions.
 */
export function injectExamplesIntoSchema(
  schema: object,
  examples: Array<{ input: Record<string, unknown> }>,
): object {
  if (!examples || examples.length === 0) return schema;

  const exampleInputs = examples.map((ex) => ex.input);
  return { ...schema, examples: exampleInputs };
}

/**
 * Measures the approximate token savings by comparing JSON lengths.
 * (Assuming ~4 chars per token)
 */
export function measureTokenSavings(
  original: object,
  optimized: object,
): { originalLength: number; optimizedLength: number; savedLength: number; approximateTokensSaved: number } {
  const originalLength = JSON.stringify(original).length;
  const optimizedLength = JSON.stringify(optimized).length;
  const savedLength = originalLength - optimizedLength;
  return {
    originalLength,
    optimizedLength,
    savedLength,
    approximateTokensSaved: Math.round(savedLength / 4),
  };
}

/**
 * Returns a token-savings report across an entire registry schema map.
 * Each entry provides the name, original schema, and optimized schema.
 */
export function getSchemaTokenReport(
  schemas: Array<{ name: string; original: object; optimized: object }>,
): {
  totalOriginalTokens: number;
  totalOptimizedTokens: number;
  totalSaved: number;
  perTool: Array<{ name: string; saved: number }>;
} {
  let totalOriginalTokens = 0;
  let totalOptimizedTokens = 0;
  const perTool: Array<{ name: string; saved: number }> = [];

  for (const { name, original, optimized } of schemas) {
    const { approximateTokensSaved, originalLength, optimizedLength } = measureTokenSavings(
      original,
      optimized,
    );
    totalOriginalTokens += Math.round(originalLength / 4);
    totalOptimizedTokens += Math.round(optimizedLength / 4);
    perTool.push({ name, saved: approximateTokensSaved });
  }

  return {
    totalOriginalTokens,
    totalOptimizedTokens,
    totalSaved: totalOriginalTokens - totalOptimizedTokens,
    perTool,
  };
}

export function shortenDescription(desc: string): string {
  let shortened = desc.trim();

  // Strip leading "The " or "A " or "An " from descriptions
  const lower = shortened.toLowerCase();
  if (lower.startsWith("the ")) shortened = shortened.slice(4).trim();
  else if (lower.startsWith("a ")) shortened = shortened.slice(2).trim();
  else if (lower.startsWith("an ")) shortened = shortened.slice(3).trim();

  // Remove trailing period BEFORE truncation/ellipsis
  if (shortened.endsWith(".")) {
    shortened = shortened.slice(0, -1);
  }

  // Truncate to first sentence if > 80 chars
  if (shortened.length > 80) {
    const periodIndex = shortened.indexOf(". ");
    if (periodIndex !== -1) {
      shortened = shortened.slice(0, periodIndex);
    } else {
      // Find a reasonable break point or just hard truncate
      const breakIndex = shortened.lastIndexOf(" ", 80);
      if (breakIndex !== -1 && breakIndex > 50) {
        shortened = shortened.slice(0, breakIndex) + "...";
      } else {
        shortened = shortened.slice(0, 77) + "...";
      }
    }
  }

  // Capitalize first letter
  if (shortened.length > 0) {
    shortened = shortened.charAt(0).toUpperCase() + shortened.slice(1);
  }

  return shortened;
}

function optimizeNode(node: unknown, propertyName: string | undefined, isRoot = false): unknown {
  if (node === null || typeof node !== "object") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((item) => optimizeNode(item, undefined));
  }

  const obj = node as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip undefined defaults
    if (key === "default" && value === undefined) {
      continue;
    }

    // Strip type-default defaults (zero values that match the declared type)
    if (key === "default") {
      const nodeType = typeof obj.type === "string" ? obj.type : undefined;
      if (isTypeDefaultValue(value, nodeType)) {
        continue;
      }
    }

    // Strip empty required arrays
    if (key === "required" && Array.isArray(value) && value.length === 0) {
      continue;
    }

    // Strip additionalProperties: true (JSON Schema default, adds no info)
    if (key === "additionalProperties" && value === true) {
      continue;
    }

    // Strip type: "object" at root level only
    if (key === "type" && value === "object" && isRoot) {
      continue;
    }

    // Strip redundant schema constraints (well-known JSON Schema defaults)
    if (key === "minLength" && value === 0) continue;
    if (key === "minItems" && value === 0) continue;
    if (key === "uniqueItems" && value === false) continue;

    // Strip title fields that match the property name (case-insensitive, with normalization)
    if (key === "title" && typeof value === "string" && propertyName) {
      const normalizedTitle = value.toLowerCase().trim().replace(/[_-]/g, " ");
      const normalizedName = propertyName.toLowerCase().replace(/[_-]/g, " ");
      if (normalizedTitle === normalizedName) {
        continue;
      }
    }

    // Process descriptions
    if (key === "description" && typeof value === "string") {
      const nodeType = typeof obj.type === "string" ? obj.type : undefined;
      if (propertyName && isRedundantDescription(propertyName, value, obj.enum as unknown[] | undefined, nodeType)) {
        continue; // strip entirely
      }

      const shortened = shortenDescription(value);
      if (shortened.length > 0) {
        result[key] = shortened;
      }
      continue;
    }

    // Recurse into properties object, passing property names down
    if (key === "properties" && typeof value === "object" && value !== null) {
      const props = value as Record<string, unknown>;
      const optimizedProps: Record<string, unknown> = {};
      for (const [propName, propSchema] of Object.entries(props)) {
        optimizedProps[propName] = optimizeNode(propSchema, propName, false);
      }
      result[key] = optimizedProps;
      continue;
    }

    // Recurse into nested schema objects
    if (isSchemaObject(key, value)) {
      result[key] = optimizeNode(value, propertyName, false);
      continue;
    }

    // Collapse single-element composition keywords into the parent
    if (isSchemaArray(key, value) && (key === "allOf" || key === "anyOf" || key === "oneOf")) {
      const arr = value as unknown[];
      if (arr.length === 1) {
        const optimized = optimizeNode(arr[0], undefined, false) as Record<string, unknown>;
        Object.assign(result, optimized);
        continue;
      }
      result[key] = arr.map((item) => optimizeNode(item, undefined, false));
      continue;
    }

    // Recurse into arrays of schemas (e.g. prefixItems)
    if (isSchemaArray(key, value)) {
      result[key] = (value as unknown[]).map((item) => optimizeNode(item, undefined, false));
      continue;
    }

    result[key] = value;
  }

  return result;
}

function isRedundantDescription(
  propertyName: string,
  description: string,
  enumValues?: unknown[],
  nodeType?: string,
): boolean {
  const normalized = description.toLowerCase().trim().replace(/[_-]/g, " ");
  const normalizedName = propertyName.toLowerCase().replace(/[_-]/g, " ");

  // Strip "Optional " / "Required " prefix before comparison
  const strippedOptional = normalized.startsWith("optional ")
    ? normalized.slice("optional ".length)
    : normalized.startsWith("required ")
    ? normalized.slice("required ".length)
    : normalized;

  // Exact match: description (possibly after stripping Optional/Required) is just the property name
  if (normalized === normalizedName || strippedOptional === normalizedName) return true;

  // "The <name>" pattern
  if (normalized === `the ${normalizedName}`) return true;

  // "A <name>" or "An <name>" pattern
  if (normalized === `a ${normalizedName}` || normalized === `an ${normalizedName}`) return true;

  // "The <words> of the <name>" or "The <words> for the <name>"
  if (
    normalized.endsWith(` of the ${normalizedName}`) ||
    normalized.endsWith(` for the ${normalizedName}`)
  ) return true;
  if (
    normalized.endsWith(` of ${normalizedName}`) ||
    normalized.endsWith(` for ${normalizedName}`)
  ) return true;

  // "ID for <name>" or "ID of <name>"
  if (
    normalized === `id for ${normalizedName}` ||
    normalized === `id of ${normalizedName}`
  ) return true;

  // Boolean patterns
  if (
    normalized === `whether to ${normalizedName}` ||
    normalized === `true if ${normalizedName}` ||
    normalized === `if true, ${normalizedName}`
  ) return true;

  // Type-obvious descriptions
  if (nodeType !== undefined && isTypeObviousDescription(normalized, nodeType)) return true;

  // Word-bag matching: if all property name words appear in description words
  // and the description has at most 2 extra meaningful words, consider it redundant
  if (isWordBagRedundant(propertyName, description)) return true;

  // Enum self-describing
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    const enumStrs = enumValues.map((v) => String(v).toLowerCase());
    const enumStr = enumStrs.join(", ");
    const enumStr2 = enumStrs.join(" or ");
    const enumStr3 = enumStrs.join("/");

    if (
      normalized === enumStr ||
      normalized === enumStr2 ||
      normalized === enumStr3 ||
      normalized === `one of: ${enumStr}` ||
      normalized === `one of ${enumStr}` ||
      normalized.includes(`[${enumStr}]`)
    ) {
      return true;
    }
  }

  return false;
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "for", "to", "is", "in", "by", "on", "it", "its", "be", "as", "at", "was", "when", "this", "that", "are", "with", "or", "and"]);

/**
 * Splits a property name into component words, handling snake_case, kebab-case, and camelCase.
 */
function splitIntoWords(name: string): string[] {
  // First split on _ and -
  const parts = name.split(/[_-]/);
  const words: string[] = [];
  for (const part of parts) {
    // Then split camelCase boundaries
    const camelParts = part.replace(/([a-z])([A-Z])/g, "$1 $2").split(" ");
    for (const w of camelParts) {
      if (w.length > 0) words.push(w.toLowerCase());
    }
  }
  return words;
}

/**
 * Returns true if the description is redundant based on word-bag matching:
 * all meaningful (non-stop) words from the property name appear in the
 * description's meaningful words, and the description has no extra meaningful
 * words beyond those in the property name.
 */
function isWordBagRedundant(propertyName: string, description: string): boolean {
  const nameWords = splitIntoWords(propertyName);
  if (nameWords.length === 0) return false;

  // Only require non-stop-word parts of the property name to appear in desc
  const meaningfulNameWords = nameWords.filter((w) => !STOP_WORDS.has(w));
  if (meaningfulNameWords.length === 0) return false;

  // Split description into words, strip punctuation, lowercase, remove stops
  const descRaw = description.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 0);
  const descWords = descRaw.filter((w) => !STOP_WORDS.has(w));

  // All meaningful name words must appear in description words
  for (const word of meaningfulNameWords) {
    if (!descWords.includes(word)) return false;
  }

  // Description must have no more meaningful words than the meaningful name words (exact subset)
  return descWords.length <= meaningfulNameWords.length;
}

/**
 * Returns true when a `default` value is the zero/empty value for the given type.
 */
function isTypeDefaultValue(value: unknown, nodeType: string | undefined): boolean {
  if (nodeType === "string" && value === "") return true;
  if ((nodeType === "number" || nodeType === "integer") && value === 0) return true;
  if (nodeType === "boolean" && value === false) return true;
  if (nodeType === "array" && Array.isArray(value) && value.length === 0) return true;
  if (nodeType === "object" && typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) return true;
  return false;
}

/**
 * Returns true when the description merely restates the field's JSON Schema type.
 * Check is case-insensitive; the caller passes a pre-lowercased `normalized` string.
 */
function isTypeObviousDescription(normalized: string, nodeType: string): boolean {
  const typePatterns: Record<string, readonly string[]> = {
    string: ["string", "a string", "a string value", "string value"],
    number: ["number", "a number", "a number value", "number value", "integer", "an integer", "a number or integer"],
    integer: ["integer", "an integer", "integer value", "number", "a number", "a number value"],
    boolean: ["boolean", "a boolean", "a boolean value", "boolean value", "true or false"],
    array: ["array", "an array", "a list", "an array of items", "list", "array of items"],
    object: ["object", "an object", "a json object", "json object"],
  };

  const patterns = typePatterns[nodeType];
  if (!patterns) return false;
  return patterns.includes(normalized);
}

function isSchemaObject(key: string, value: unknown): value is Record<string, unknown> {
  const schemaKeys = ["items", "additionalProperties", "not", "if", "then", "else"];
  return (
    schemaKeys.includes(key) &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isSchemaArray(key: string, value: unknown): value is unknown[] {
  const arrayKeys = ["allOf", "anyOf", "oneOf", "prefixItems"];
  return arrayKeys.includes(key) && Array.isArray(value);
}

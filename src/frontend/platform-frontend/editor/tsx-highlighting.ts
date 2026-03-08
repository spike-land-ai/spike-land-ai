export interface HighlightSegment {
  startOffset: number;
  endOffset: number;
  className: string;
}

const JSX_EXTENSIONS = new Set(["tsx", "jsx"]);
const TAILWIND_ATTRS = new Set(["class", "className", "tw"]);
const TAILWIND_HELPERS = /\b(?:cn|clsx|twMerge)\s*\(/g;
const TAG_NAME = /[A-Za-z][\w.-]*/y;
const ATTR_NAME = /[A-Za-z_:][\w:.-]*/y;
const WHITESPACE = /\s*/y;

type TailwindTokenKind =
  | "spike-tailwind-layout"
  | "spike-tailwind-spacing"
  | "spike-tailwind-color"
  | "spike-tailwind-utility";

export function isJsxLikeFile(fileName?: string): boolean {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  return ext !== undefined && JSX_EXTENSIONS.has(ext);
}

export function collectEditorHighlightSegments(code: string, fileName?: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];

  if (isJsxLikeFile(fileName)) {
    segments.push(...collectJsxSegments(code));
    segments.push(...collectHelperTailwindSegments(code));
  }

  return segments;
}

function collectJsxSegments(code: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let index = 0;

  while (index < code.length) {
    if (startsWith(code, index, "//")) {
      index = skipLineComment(code, index);
      continue;
    }

    if (startsWith(code, index, "/*")) {
      index = skipBlockComment(code, index);
      continue;
    }

    if (isQuote(code[index])) {
      index = skipString(code, index);
      continue;
    }

    if (code[index] === "<") {
      const parsed = parseJsxTag(code, index);
      if (parsed !== null) {
        segments.push(...parsed.segments);
        index = parsed.endOffset;
        continue;
      }
    }

    index += 1;
  }

  return segments;
}

function collectHelperTailwindSegments(code: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];

  for (const match of code.matchAll(TAILWIND_HELPERS)) {
    const openParenIndex = match.index! + match[0].length - 1;
    const expressionEnd = findMatchingBracket(code, openParenIndex, "(", ")");
    if (expressionEnd === -1) continue;

    const expression = code.slice(openParenIndex + 1, expressionEnd);
    segments.push(...collectTailwindStringSegments(expression, openParenIndex + 1));
  }

  return segments;
}

function parseJsxTag(
  code: string,
  startOffset: number,
): { endOffset: number; segments: HighlightSegment[] } | null {
  let index = startOffset + 1;
  const segments: HighlightSegment[] = [];

  if (code[index] === "/") {
    index += 1;
  }

  TAG_NAME.lastIndex = index;
  const tagMatch = TAG_NAME.exec(code);
  if (tagMatch === null) return null;

  const tagNameStart = index;
  const tagNameEnd = index + tagMatch[0].length;

  if (!looksLikeJsxTag(code, startOffset, tagNameEnd)) {
    return null;
  }

  segments.push({
    startOffset: tagNameStart,
    endOffset: tagNameEnd,
    className: "spike-jsx-tag",
  });

  index = tagNameEnd;

  while (index < code.length) {
    WHITESPACE.lastIndex = index;
    const whitespaceMatch = WHITESPACE.exec(code);
    index = whitespaceMatch?.index === index ? whitespaceMatch[0].length + index : index;

    if (startsWith(code, index, "/>")) {
      return { endOffset: index + 2, segments };
    }

    if (code[index] === ">") {
      return { endOffset: index + 1, segments };
    }

    ATTR_NAME.lastIndex = index;
    const attrMatch = ATTR_NAME.exec(code);

    if (attrMatch === null) {
      index += 1;
      continue;
    }

    const attrName = attrMatch[0];
    const attrStart = index;
    const attrEnd = index + attrName.length;
    segments.push({
      startOffset: attrStart,
      endOffset: attrEnd,
      className: "spike-jsx-attr",
    });

    index = attrEnd;
    WHITESPACE.lastIndex = index;
    const postAttrWhitespace = WHITESPACE.exec(code);
    index = postAttrWhitespace?.index === index ? postAttrWhitespace[0].length + index : index;

    if (code[index] !== "=") {
      continue;
    }

    index += 1;
    WHITESPACE.lastIndex = index;
    const postEqualsWhitespace = WHITESPACE.exec(code);
    index =
      postEqualsWhitespace?.index === index ? postEqualsWhitespace[0].length + index : index;

    const current = code[index];
    if (current === undefined) break;

    if (isQuote(current)) {
      const stringEnd = findStringEnd(code, index);
      if (stringEnd === -1) break;

      if (TAILWIND_ATTRS.has(attrName)) {
        segments.push(...collectTailwindSegmentsFromLiteral(code.slice(index + 1, stringEnd), index + 1));
      } else {
        segments.push({
          startOffset: index + 1,
          endOffset: stringEnd,
          className: "spike-jsx-attr-value",
        });
      }

      index = stringEnd + 1;
      continue;
    }

    if (current === "{") {
      const expressionEnd = findMatchingBracket(code, index, "{", "}");
      if (expressionEnd === -1) break;

      if (TAILWIND_ATTRS.has(attrName)) {
        const expression = code.slice(index + 1, expressionEnd);
        segments.push(...collectTailwindStringSegments(expression, index + 1));
      }

      index = expressionEnd + 1;
      continue;
    }
  }

  return null;
}

function looksLikeJsxTag(code: string, tagStart: number, tagNameEnd: number): boolean {
  const next = code[tagNameEnd];
  if (next === ">" || next === "/" || next === " " || next === "\n" || next === "\t") {
    return true;
  }

  if (next === "=") {
    return false;
  }

  if (code[tagStart + 1] === "/") {
    return true;
  }

  return false;
}

function collectTailwindStringSegments(expression: string, offsetBase: number): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (char === "/" && expression[index + 1] === "/") {
      index = skipLineComment(expression, index);
      continue;
    }

    if (char === "/" && expression[index + 1] === "*") {
      index = skipBlockComment(expression, index);
      continue;
    }

    if (!isQuote(char)) {
      index += 1;
      continue;
    }

    const end = findStringEnd(expression, index);
    if (end === -1) break;

    segments.push(...collectTailwindSegmentsFromLiteral(expression.slice(index + 1, end), offsetBase + index + 1));
    index = end + 1;
  }

  return segments;
}

function collectTailwindSegmentsFromLiteral(value: string, startOffset: number): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  const tokenRegex = /\S+/g;

  for (const match of value.matchAll(tokenRegex)) {
    const token = match[0];
    const tokenStart = startOffset + match.index!;
    const tokenParts = splitTailwindToken(token);

    if (tokenParts.length === 0) continue;

    let cursor = tokenStart;
    for (const prefix of tokenParts.slice(0, -1)) {
      segments.push({
        startOffset: cursor,
        endOffset: cursor + prefix.length + 1,
        className: "spike-tailwind-variant",
      });
      cursor += prefix.length + 1;
    }

    const utility = tokenParts[tokenParts.length - 1]!;
    segments.push({
      startOffset: cursor,
      endOffset: cursor + utility.length,
      className: classifyTailwindToken(utility),
    });
  }

  return segments;
}

function splitTailwindToken(token: string): string[] {
  const parts: string[] = [];
  let bracketDepth = 0;
  let current = "";

  for (const char of token) {
    if (char === "[" || char === "(" || char === "{") bracketDepth += 1;
    if (char === "]" || char === ")" || char === "}") bracketDepth = Math.max(0, bracketDepth - 1);

    if (char === ":" && bracketDepth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts.filter(Boolean);
}

function classifyTailwindToken(token: string): TailwindTokenKind {
  if (
    /^(?:absolute|relative|fixed|sticky|block|inline|inline-block|inline-flex|flex|grid|hidden|contents|table|justify-|items-|content-|place-|self-|overflow-|object-|z-|basis-|grow|shrink|order-)/.test(
      token,
    )
  ) {
    return "spike-tailwind-layout";
  }

  if (
    /^(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|space-x|space-y|gap|w|h|min-w|min-h|max-w|max-h|size|inset|top|right|bottom|left)-/.test(
      token,
    )
  ) {
    return "spike-tailwind-spacing";
  }

  if (
    /^(?:bg|text|border|ring|outline|shadow|from|via|to|decoration|caret|fill|stroke|placeholder)-/.test(
      token,
    )
  ) {
    return "spike-tailwind-color";
  }

  return "spike-tailwind-utility";
}

function findMatchingBracket(
  value: string,
  openIndex: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0;
  let index = openIndex;

  while (index < value.length) {
    if (startsWith(value, index, "//")) {
      index = skipLineComment(value, index);
      continue;
    }

    if (startsWith(value, index, "/*")) {
      index = skipBlockComment(value, index);
      continue;
    }

    if (isQuote(value[index])) {
      index = skipString(value, index);
      continue;
    }

    if (value[index] === openChar) depth += 1;
    if (value[index] === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }

    index += 1;
  }

  return -1;
}

function skipLineComment(value: string, start: number): number {
  const end = value.indexOf("\n", start);
  return end === -1 ? value.length : end + 1;
}

function skipBlockComment(value: string, start: number): number {
  const end = value.indexOf("*/", start + 2);
  return end === -1 ? value.length : end + 2;
}

function skipString(value: string, start: number): number {
  const end = findStringEnd(value, start);
  return end === -1 ? value.length : end + 1;
}

function findStringEnd(value: string, start: number): number {
  const quote = value[start];
  let index = start + 1;

  while (index < value.length) {
    if (value[index] === "\\") {
      index += 2;
      continue;
    }

    if (value[index] === quote) {
      return index;
    }

    index += 1;
  }

  return -1;
}

function isQuote(value: string | undefined): value is '"' | "'" | "`" {
  return value === '"' || value === "'" || value === "`";
}

function startsWith(value: string, index: number, needle: string): boolean {
  return value.slice(index, index + needle.length) === needle;
}

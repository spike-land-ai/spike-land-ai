/**
 * Guard Expression Parser
 *
 * Safe recursive-descent parser for guard expressions used by the statechart
 * engine. Supports arithmetic, comparison, logical operators, string/number
 * literals, boolean/null keywords, and context field access.
 */

// ---------------------------------------------------------------------------
// Parser types
// ---------------------------------------------------------------------------

interface Parser {
  input: string;
  pos: number;
  context: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tokenizer helpers
// ---------------------------------------------------------------------------

function createParser(expression: string, context: Record<string, unknown>): Parser {
  return { input: expression, pos: 0, context };
}

function skipWhitespace(p: Parser): void {
  while (p.pos < p.input.length && /\s/.test(p.input[p.pos]!)) {
    p.pos++;
  }
}

function peek(p: Parser, expected: string): boolean {
  skipWhitespace(p);
  return p.input.startsWith(expected, p.pos);
}

function consume(p: Parser, expected: string): void {
  skipWhitespace(p);
  if (!p.input.startsWith(expected, p.pos)) {
    throw new Error(
      `Guard parse error at position ${p.pos}: expected "${expected}", found "${p.input.slice(
        p.pos,
        p.pos + 10,
      )}"`,
    );
  }
  p.pos += expected.length;
}

// ---------------------------------------------------------------------------
// Recursive descent grammar
// ---------------------------------------------------------------------------

function parseExpr(p: Parser): unknown {
  return parseOrExpr(p);
}

function parseOrExpr(p: Parser): unknown {
  let left = parseAndExpr(p);
  while (peek(p, "||")) {
    consume(p, "||");
    const right = parseAndExpr(p);
    left = Boolean(left) || Boolean(right);
  }
  return left;
}

function parseAndExpr(p: Parser): unknown {
  let left = parseNotExpr(p);
  while (peek(p, "&&")) {
    consume(p, "&&");
    const right = parseNotExpr(p);
    left = Boolean(left) && Boolean(right);
  }
  return left;
}

function parseNotExpr(p: Parser): unknown {
  skipWhitespace(p);
  if (peek(p, "!") && !peek(p, "!=")) {
    consume(p, "!");
    const val = parseNotExpr(p);
    return !val;
  }
  return parseCompare(p);
}

function parseCompare(p: Parser): unknown {
  const left = parseAddSub(p);
  skipWhitespace(p);

  const ops = ["==", "!=", ">=", "<=", ">", "<"];
  for (const op of ops) {
    if (peek(p, op)) {
      consume(p, op);
      const right = parseAddSub(p);
      switch (op) {
        case "==":
          return left === right;
        case "!=":
          return left !== right;
        case ">":
          return (left as number) > (right as number);
        case "<":
          return (left as number) < (right as number);
        case ">=":
          return (left as number) >= (right as number);
        case "<=":
          return (left as number) <= (right as number);
      }
    }
  }

  return left;
}

function parseAddSub(p: Parser): unknown {
  let left = parseMulDiv(p);
  while (peek(p, "+") || peek(p, "-")) {
    if (peek(p, "+")) {
      consume(p, "+");
      const right = parseMulDiv(p);
      left = (left as number) + (right as number);
    } else {
      consume(p, "-");
      const right = parseMulDiv(p);
      left = (left as number) - (right as number);
    }
  }
  return left;
}

function parseMulDiv(p: Parser): unknown {
  let left = parsePow(p);
  while (peek(p, "*") || peek(p, "/")) {
    if (peek(p, "*")) {
      consume(p, "*");
      const right = parsePow(p);
      left = (left as number) * (right as number);
    } else {
      consume(p, "/");
      const right = parsePow(p);
      if (right === 0) {
        throw new Error("Division by zero in guard expression");
      }
      left = (left as number) / (right as number);
    }
  }
  return left;
}

function parsePow(p: Parser): unknown {
  let left = parsePrimary(p);
  while (peek(p, "**")) {
    consume(p, "**");
    const right = parsePrimary(p);
    left = Math.pow(left as number, right as number);
  }
  return left;
}

function resolvePath(obj: unknown, path: string[]): unknown {
  let value = obj;
  for (const key of path) {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "object") {
      value = (value as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return value;
}

function parsePrimary(p: Parser): unknown {
  skipWhitespace(p);

  // Parenthesized expression
  if (peek(p, "(")) {
    consume(p, "(");
    const val = parseExpr(p);
    consume(p, ")");
    return val;
  }

  // String literal (double-quoted)
  if (p.pos < p.input.length && p.input[p.pos] === '"') {
    p.pos++; // skip opening quote
    let str = "";
    while (p.pos < p.input.length && p.input[p.pos] !== '"') {
      if (p.input[p.pos] === "\\") {
        p.pos++;
        if (p.pos >= p.input.length) {
          throw new Error("Guard parse error: unterminated string escape");
        }
      }
      str += p.input[p.pos];
      p.pos++;
    }
    if (p.pos >= p.input.length) {
      throw new Error("Guard parse error: unterminated string literal");
    }
    p.pos++; // skip closing quote
    return str;
  }

  // String literal (single-quoted)
  if (p.pos < p.input.length && p.input[p.pos] === "'") {
    p.pos++; // skip opening quote
    let str = "";
    while (p.pos < p.input.length && p.input[p.pos] !== "'") {
      if (p.input[p.pos] === "\\") {
        p.pos++;
        if (p.pos >= p.input.length) {
          throw new Error("Guard parse error: unterminated string escape");
        }
      }
      str += p.input[p.pos];
      p.pos++;
    }
    if (p.pos >= p.input.length) {
      throw new Error("Guard parse error: unterminated string literal");
    }
    p.pos++; // skip closing quote
    return str;
  }

  // Number literal
  if (
    p.pos < p.input.length &&
    (/\d/.test(p.input[p.pos]!) ||
      (p.input[p.pos] === "-" && p.pos + 1 < p.input.length && /\d/.test(p.input[p.pos + 1]!)))
  ) {
    let numStr = "";
    if (p.input[p.pos] === "-") {
      numStr += "-";
      p.pos++;
    }
    while (p.pos < p.input.length && /[\d.]/.test(p.input[p.pos]!)) {
      numStr += p.input[p.pos]!;
      p.pos++;
    }
    const num = Number(numStr);
    if (isNaN(num)) {
      throw new Error(`Guard parse error: invalid number "${numStr}"`);
    }
    return num;
  }

  // Boolean / null keywords and context access
  skipWhitespace(p);
  const identStart = p.pos;
  while (p.pos < p.input.length && /[a-zA-Z0-9_.]/.test(p.input[p.pos]!)) {
    p.pos++;
  }
  const ident = p.input.slice(identStart, p.pos);

  if (ident === "") {
    throw new Error(
      `Guard parse error at position ${p.pos}: unexpected character "${p.input[p.pos] ?? "EOF"}"`,
    );
  }

  if (ident === "true") return true;
  if (ident === "false") return false;
  if (ident === "null") return null;

  // Context access: context.field.subfield
  if (ident.startsWith("context.")) {
    const path = ident.slice("context.".length).split(".");
    return resolvePath(p.context, path);
  }

  // Event access: event.field.subfield (maps to context._event.field.subfield)
  if (ident.startsWith("event.")) {
    const path = ["_event", ...ident.slice("event.".length).split(".")];
    return resolvePath(p.context, path);
  }

  throw new Error(
    `Guard parse error: unknown identifier "${ident}". Use "context.fieldName" or "event.fieldName" for access.`,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a guard expression string against a context object.
 * Returns true if the expression evaluates to a truthy value.
 */
export function evaluateGuard(expression: string, context: Record<string, unknown>): boolean {
  return Boolean(evaluateExpression(expression, context));
}

/**
 * Evaluate an arbitrary expression string against a context object.
 * Returns the raw result value (may be string, number, boolean, null, etc.).
 */
export function evaluateExpression(expression: string, context: Record<string, unknown>): unknown {
  const p = createParser(expression, context);
  const result = parseExpr(p);
  skipWhitespace(p);
  if (p.pos < p.input.length) {
    throw new Error(
      `Expression parse error: unexpected trailing content at position ${p.pos}: "${p.input.slice(
        p.pos,
      )}"`,
    );
  }
  return result;
}

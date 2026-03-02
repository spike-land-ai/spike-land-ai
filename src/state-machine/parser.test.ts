import { describe, it, expect } from "vitest";
import { evaluateExpression, evaluateGuard } from "./parser.js";

describe("Guard Expression Parser", () => {
  const context = {
    count: 10,
    user: { name: "John", active: true },
    _event: { type: "CLICK", value: 42 },
  };

  it("should evaluate arithmetic expressions", () => {
    expect(evaluateExpression("1 + 2 * 3", context)).toBe(7);
    expect(evaluateExpression("(1 + 2) * 3", context)).toBe(9);
    expect(evaluateExpression("2 ** 3", context)).toBe(8);
    expect(evaluateExpression("10 / 2", context)).toBe(5);
  });

  it("should evaluate comparison expressions", () => {
    expect(evaluateExpression("10 > 5", context)).toBe(true);
    expect(evaluateExpression("10 < 5", context)).toBe(false);
    expect(evaluateExpression("10 == 10", context)).toBe(true);
    expect(evaluateExpression("10 != 5", context)).toBe(true);
  });

  it("should evaluate logical expressions", () => {
    expect(evaluateExpression("true && false", context)).toBe(false);
    expect(evaluateExpression("true || false", context)).toBe(true);
    expect(evaluateExpression("!true", context)).toBe(false);
    expect(evaluateExpression("!!true", context)).toBe(true);
  });

  it("should access context fields", () => {
    expect(evaluateExpression("context.count", context)).toBe(10);
    expect(evaluateExpression("context.user.name", context)).toBe("John");
    expect(evaluateExpression("context.user.active == true", context)).toBe(true);
  });

  it("should access event fields using event. prefix", () => {
    expect(evaluateExpression("event.type", context)).toBe("CLICK");
    expect(evaluateExpression("event.value", context)).toBe(42);
    expect(evaluateExpression("event.value > 40", context)).toBe(true);
  });

  it("should handle string literals", () => {
    expect(evaluateExpression("'hello'", context)).toBe("hello");
    expect(evaluateExpression('"world"', context)).toBe("world");
    expect(evaluateExpression("context.user.name == 'John'", context)).toBe(true);
  });

  it("should throw on division by zero", () => {
    expect(() => evaluateExpression("10 / 0", context)).toThrow("Division by zero");
  });

  it("should throw on unknown identifier", () => {
    expect(() => evaluateExpression("unknown.field", context)).toThrow("unknown identifier");
  });

  it("should evaluate guards correctly", () => {
    expect(evaluateGuard("context.count > 5", context)).toBe(true);
    expect(evaluateGuard("context.count < 5", context)).toBe(false);
  });
});

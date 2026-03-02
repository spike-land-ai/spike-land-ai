import { describe, expect, it } from "vitest";
import { validateInput } from "./validate.js";

describe("validateInput", () => {
  const simpleSchema = {
    type: "object" as const,
    properties: {
      name: { type: "string" },
      age: { type: "number" },
      active: { type: "boolean" },
    },
    required: ["name"],
    additionalProperties: false,
  };

  it("should pass valid input", () => {
    const result = validateInput({ name: "Alice", age: 30 }, simpleSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("should fail on missing required field", () => {
    const result = validateInput({ age: 30 }, simpleSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('missing required field "name"'));
  });

  it("should fail on wrong type", () => {
    const result = validateInput({ name: 123 }, simpleSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("expected string"));
  });

  it("should fail on additional properties", () => {
    const result = validateInput({ name: "Bob", extra: true }, simpleSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining('unexpected property "extra"'));
  });

  it("should fail on null input", () => {
    const result = validateInput(null, simpleSchema);
    expect(result.valid).toBe(false);
  });

  it("should fail on array input", () => {
    const result = validateInput([], simpleSchema);
    expect(result.valid).toBe(false);
  });

  it("should fail on undefined input", () => {
    const result = validateInput(undefined, simpleSchema);
    expect(result.valid).toBe(false);
  });

  it("should validate enum values", () => {
    const schema = {
      type: "object" as const,
      properties: {
        privacy: { type: "string", enum: ["PRIVATE", "PUBLIC"] },
      },
      required: ["privacy"] as string[],
    };
    expect(validateInput({ privacy: "PRIVATE" }, schema).valid).toBe(true);
    const bad = validateInput({ privacy: "UNKNOWN" }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("expected one of");
  });

  it("should validate array items", () => {
    const schema = {
      type: "object" as const,
      properties: {
        tags: { type: "array", items: { type: "string" } },
      },
    };
    expect(validateInput({ tags: ["a", "b"] }, schema).valid).toBe(true);
    const bad = validateInput({ tags: ["a", 123] }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("expected string");
  });

  it("should validate non-array passed as array", () => {
    const schema = {
      type: "object" as const,
      properties: {
        tags: { type: "array", items: { type: "string" } },
      },
    };
    const bad = validateInput({ tags: "not-an-array" }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("expected array");
  });

  it("should resolve $ref definitions", () => {
    const schema = {
      type: "object" as const,
      properties: {
        tier: { $ref: "#/definitions/EnhancementTier" },
      },
      required: ["tier"] as string[],
    };
    const root = {
      definitions: {
        EnhancementTier: {
          type: "string",
          enum: ["FREE", "TIER_1K", "TIER_2K"],
        },
      },
    };
    expect(validateInput({ tier: "FREE" }, schema, root).valid).toBe(true);
    const bad = validateInput({ tier: "INVALID" }, schema, root);
    expect(bad.valid).toBe(false);
  });

  it("should allow optional fields to be omitted", () => {
    const result = validateInput({ name: "Alice" }, simpleSchema);
    expect(result.valid).toBe(true);
  });

  it("should validate boolean type mismatch", () => {
    const result = validateInput({ name: "Alice", active: "yes" }, simpleSchema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("expected boolean");
  });

  it("should validate number type mismatch", () => {
    const result = validateInput({ name: "Alice", age: "thirty" }, simpleSchema);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("expected number");
  });

  it("should collect multiple errors", () => {
    const result = validateInput({ age: "bad" }, simpleSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("should validate range minimum", () => {
    const schema = {
      type: "object" as const,
      properties: {
        count: { type: "number", minimum: 1 },
      },
    };
    expect(validateInput({ count: 1 }, schema).valid).toBe(true);
    const bad = validateInput({ count: 0 }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("less than minimum");
  });

  it("should validate range maximum", () => {
    const schema = {
      type: "object" as const,
      properties: {
        count: { type: "number", maximum: 10 },
      },
    };
    expect(validateInput({ count: 10 }, schema).valid).toBe(true);
    const bad = validateInput({ count: 11 }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("greater than maximum");
  });

  it("should accept empty input when no required fields", () => {
    const schema = {
      type: "object" as const,
      properties: { limit: { type: "number" } },
    };
    expect(validateInput({}, schema).valid).toBe(true);
  });

  it("should treat unresolvable $ref as valid (no type to check)", () => {
    // When $ref doesn't match #/definitions/... format, resolveRef returns undefined
    // and resolveSchema returns the original node (with $ref but no type)
    const schema = {
      type: "object" as const,
      properties: {
        foo: { $ref: "http://external/schema" },
      },
    };
    // No type constraint — passes through without error
    expect(validateInput({ foo: "anything" }, schema).valid).toBe(true);
  });

  it("should treat schema node without type as valid (skip type checks)", () => {
    // A schema with no type property should not enforce type
    const schema = {
      type: "object" as const,
      properties: {
        anything: { description: "any value" },
      },
    };
    expect(validateInput({ anything: 42 }, schema).valid).toBe(true);
    expect(validateInput({ anything: "string" }, schema).valid).toBe(true);
  });

  it("should skip property validation when property key is present but value is undefined", () => {
    // obj[key] !== undefined condition: undefined values are skipped in property validation
    const schema = {
      type: "object" as const,
      properties: {
        name: { type: "string" },
      },
    };
    // Passing undefined explicitly — the property exists but value is undefined, so skipped
    const obj: Record<string, unknown> = {};
    obj["name"] = undefined;
    expect(validateInput(obj, schema).valid).toBe(true);
  });

  it("should fail on float value for integer type", () => {
    const schema = {
      type: "object" as const,
      properties: {
        count: { type: "integer" },
      },
    };
    const bad = validateInput({ count: 1.5 }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("expected integer");
  });

  it("should fail on non-number value for integer type", () => {
    const schema = {
      type: "object" as const,
      properties: {
        count: { type: "integer" },
      },
    };
    const bad = validateInput({ count: "five" }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("expected integer");
  });

  it("should accept valid integer value", () => {
    const schema = {
      type: "object" as const,
      properties: {
        count: { type: "integer" },
      },
    };
    expect(validateInput({ count: 5 }, schema).valid).toBe(true);
  });

  it("should fail with null value for object type property", () => {
    const schema = {
      type: "object" as const,
      properties: {
        metadata: { type: "object" as const, properties: {} },
      },
    };
    const bad = validateInput({ metadata: null }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("expected object");
    expect(bad.errors[0]).toContain("null");
  });

  it("should validate object schema without properties defined", () => {
    const schema = {
      type: "object" as const,
      properties: {
        config: { type: "object" as const },
      },
    };
    // Object without properties field should be valid
    expect(validateInput({ config: { any: "value" } }, schema).valid).toBe(true);
  });

  it("should fail with array value for object type property", () => {
    const schema = {
      type: "object" as const,
      properties: {
        metadata: { type: "object" as const, properties: {} },
      },
    };
    const bad = validateInput({ metadata: [1, 2, 3] }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toContain("expected object");
  });
});

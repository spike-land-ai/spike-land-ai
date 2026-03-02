import { describe, it, expect } from "vitest";
import { optimizeSchema } from "./schema-optimizer";

describe("optimizeSchema", () => {
  it("returns a copy without mutating the original", () => {
    const schema = { type: "object", description: "A schema" };
    const result = optimizeSchema(schema);
    expect(result).toEqual(schema);
    expect(result).not.toBe(schema);
  });

  it("strips descriptions that exactly match the property name", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", description: "name" },
        age: { type: "number", description: "User age in years" },
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.name).not.toHaveProperty("description");
    expect(props.age!.description).toBe("User age in years");
  });

  it("strips 'the <name>' descriptions", () => {
    const schema = {
      type: "object",
      properties: {
        query: { type: "string", description: "The query" },
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.query).not.toHaveProperty("description");
  });

  it("strips 'a <name>' descriptions", () => {
    const schema = {
      type: "object",
      properties: {
        file: { type: "string", description: "A file" },
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.file).not.toHaveProperty("description");
  });

  it("handles underscore/hyphen property names", () => {
    const schema = {
      type: "object",
      properties: {
        file_path: { type: "string", description: "file path" },
        "max-count": { type: "number", description: "The max count" },
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.file_path).not.toHaveProperty("description");
    expect(props["max-count"]).not.toHaveProperty("description");
  });

  it("removes undefined default values", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string", default: undefined },
        age: { type: "number", default: 0 },
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.name).not.toHaveProperty("default");
    expect(props.age!.default).toBe(0);
  });

  it("preserves meaningful descriptions", () => {
    const schema = {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query to execute against the index" },
        limit: { type: "number", description: "Maximum number of results to return" },
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.query!.description).toBe("The search query to execute against the index");
    expect(props.limit!.description).toBe("Maximum number of results to return");
  });

  it("handles nested schemas (items)", () => {
    const schema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          description: "List of tags",
          items: { type: "string", description: "tags" },
        },
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    const items = props.tags!.items as Record<string, unknown>;
    // "tags" description inside items doesn't have a propertyName context for items
    // (items doesn't pass down a property name), so it's kept
    expect(items.type).toBe("string");
  });

  it("handles allOf/anyOf/oneOf arrays", () => {
    const schema = {
      type: "object",
      anyOf: [{ type: "string" }, { type: "number" }],
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    expect(result.anyOf).toEqual([{ type: "string" }, { type: "number" }]);
  });

  it("handles empty schema", () => {
    expect(optimizeSchema({})).toEqual({});
  });

  it("handles schema with no properties", () => {
    const schema = { type: "object", required: ["name"] };
    expect(optimizeSchema(schema)).toEqual(schema);
  });

  it("case-insensitive description matching", () => {
    const schema = {
      type: "object",
      properties: {
        Name: { type: "string", description: "name" },
        URL: { type: "string", description: "A URL" },
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.Name).not.toHaveProperty("description");
    expect(props.URL).not.toHaveProperty("description");
  });
});

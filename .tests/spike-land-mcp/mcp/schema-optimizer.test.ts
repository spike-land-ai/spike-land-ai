import { describe, expect, it } from "vitest";
import { optimizeSchema, shortenDescription, measureTokenSavings } from "../../../src/spike-land-mcp/mcp/schema-optimizer";

describe("optimizeSchema", () => {
  it("returns a copy without mutating the original", () => {
    const schema = { type: "object", description: "A schema" };
    const result = optimizeSchema(schema);
    expect(result).toEqual({ type: "object", description: "Schema" });
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
  
  it("strips 'the <words> of the <name>' descriptions", () => {
    const schema = {
      type: "object",
      properties: {
        image_id: { type: "string", description: "The ID of the image_id" },
        user_id: { type: "string", description: "ID for user_id" }
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.image_id).not.toHaveProperty("description");
    expect(props.user_id).not.toHaveProperty("description");
  });
  
  it("strips boolean pattern descriptions", () => {
    const schema = {
      type: "object",
      properties: {
        force: { type: "boolean", description: "Whether to force" },
        dry_run: { type: "boolean", description: "True if dry run" },
        recursive: { type: "boolean", description: "If true, recursive" }
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.force).not.toHaveProperty("description");
    expect(props.dry_run).not.toHaveProperty("description");
    expect(props.recursive).not.toHaveProperty("description");
  });
  
  it("strips enum self-describing descriptions", () => {
    const schema = {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "closed"], description: "open, closed" },
        role: { type: "string", enum: ["admin", "user"], description: "admin or user" },
        type: { type: "string", enum: ["a", "b"], description: "One of: a, b" }
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.status).not.toHaveProperty("description");
    expect(props.role).not.toHaveProperty("description");
    expect(props.type).not.toHaveProperty("description");
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

  it("preserves meaningful descriptions and shortens them", () => {
    const schema = {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to execute against the index.",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
      },
    };

    const result = optimizeSchema(schema) as Record<string, unknown>;
    const props = result.properties as Record<string, Record<string, unknown>>;
    expect(props.query!.description).toBe("Search query to execute against the index");
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

describe("shortenDescription", () => {
  it("strips leading articles and capitalizes", () => {
    expect(shortenDescription("The quick brown fox")).toBe("Quick brown fox");
    expect(shortenDescription("A quick brown fox")).toBe("Quick brown fox");
    expect(shortenDescription("An apple")).toBe("Apple");
  });

  it("removes trailing periods", () => {
    expect(shortenDescription("This is a test.")).toBe("This is a test");
  });

  it("truncates at the first sentence if over 80 chars", () => {
    const longDesc = "This is a very long description that goes on for quite a while to exceed eighty characters. This is the second sentence.";
    expect(shortenDescription(longDesc)).toBe("This is a very long description that goes on for quite a while to exceed eighty characters");
  });
  
  it("hard truncates if over 80 chars and no sentence break", () => {
    const longDesc = "This is a very long description that just keeps going and going without any period whatsoever to break it up";
    expect(shortenDescription(longDesc).length).toBeLessThan(85);
    expect(shortenDescription(longDesc).endsWith("...")).toBe(true);
  });
});

describe("measureTokenSavings", () => {
  it("calculates savings correctly", () => {
    const original = { a: 1, b: 2, description: "A very long description that will be removed" };
    const optimized = { a: 1, b: 2 };
    
    const result = measureTokenSavings(original, optimized);
    expect(result.originalLength).toBeGreaterThan(result.optimizedLength);
    expect(result.savedLength).toBe(result.originalLength - result.optimizedLength);
    expect(result.approximateTokensSaved).toBe(Math.round(result.savedLength / 4));
  });
});

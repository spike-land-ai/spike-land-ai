import { describe, it, expect } from "vitest";
import { generateId } from "../core-logic/id-gen";

describe("id-gen", () => {
  it("generates a valid ULID", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(26);
  });
});

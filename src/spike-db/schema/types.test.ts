import { describe, it, expect } from "vitest";
import { MIGRATION_KINDS } from "./types.js";

describe("types", () => {
  it("defines MIGRATION_KINDS", () => {
    expect(MIGRATION_KINDS).toContain("add_table");
  });
});

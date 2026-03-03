import { describe, expect, it } from "vitest";
import { contestEntryMetadata } from "./metadata";

describe("contest-entry/metadata", () => {
  it("should have id 'contest-entry'", () => {
    expect(contestEntryMetadata.id).toBe("contest-entry");
  });

  it("should have a name", () => {
    expect(contestEntryMetadata.name).toBe("Contest Entry Form");
  });

  it("should have purpose 'contest'", () => {
    expect(contestEntryMetadata.purpose).toBe("contest");
  });

  it("should have contest-related tags", () => {
    expect(contestEntryMetadata.tags).toContain("contest");
    expect(contestEntryMetadata.tags).toContain("form");
  });

  it("should have a description", () => {
    expect(contestEntryMetadata.description.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { interactivePollMetadata } from "./metadata";

describe("interactive-poll/metadata", () => {
  it("should have id 'interactive-poll'", () => {
    expect(interactivePollMetadata.id).toBe("interactive-poll");
  });

  it("should have a name", () => {
    expect(interactivePollMetadata.name).toBe("Interactive Poll");
  });

  it("should have purpose 'poll'", () => {
    expect(interactivePollMetadata.purpose).toBe("poll");
  });

  it("should have engagement-related tags", () => {
    expect(interactivePollMetadata.tags).toContain("poll");
    expect(interactivePollMetadata.tags).toContain("interactive");
  });

  it("should have a description", () => {
    expect(interactivePollMetadata.description.length).toBeGreaterThan(0);
  });
});

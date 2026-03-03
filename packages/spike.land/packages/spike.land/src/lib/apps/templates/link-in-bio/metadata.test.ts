import { describe, expect, it } from "vitest";
import { linkInBioMetadata } from "./metadata";

describe("link-in-bio/metadata", () => {
  it("should have id 'link-in-bio'", () => {
    expect(linkInBioMetadata.id).toBe("link-in-bio");
  });

  it("should have a name", () => {
    expect(linkInBioMetadata.name).toBe("Link-in-Bio Page");
  });

  it("should have purpose 'link-in-bio'", () => {
    expect(linkInBioMetadata.purpose).toBe("link-in-bio");
  });

  it("should have social-media-related tags", () => {
    expect(linkInBioMetadata.tags).toContain("social-media");
    expect(linkInBioMetadata.tags).toContain("links");
  });

  it("should have a description", () => {
    expect(linkInBioMetadata.description.length).toBeGreaterThan(0);
  });
});

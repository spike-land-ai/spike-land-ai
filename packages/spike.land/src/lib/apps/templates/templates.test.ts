import { describe, expect, it } from "vitest";

import { campaignLandingCode } from "./campaign-landing/code";
import { campaignLandingMetadata } from "./campaign-landing/metadata";
import { contestEntryCode } from "./contest-entry/code";
import { contestEntryMetadata } from "./contest-entry/metadata";
import { interactivePollCode } from "./interactive-poll/code";
import { interactivePollMetadata } from "./interactive-poll/metadata";
import { linkInBioCode } from "./link-in-bio/code";
import { linkInBioMetadata } from "./link-in-bio/metadata";
import type { Template, TemplateMetadata, TemplatePurpose } from "./types";

// ---------------------------------------------------------------------------
// Type-level tests for templates/types.ts
// ---------------------------------------------------------------------------
describe("templates/types", () => {
  it("should allow creating a valid TemplateMetadata object", () => {
    const metadata: TemplateMetadata = {
      id: "test-id",
      name: "Test Template",
      description: "A test template",
      purpose: "poll",
      tags: ["test"],
    };

    expect(metadata.id).toBe("test-id");
    expect(metadata.name).toBe("Test Template");
    expect(metadata.description).toBe("A test template");
    expect(metadata.purpose).toBe("poll");
    expect(metadata.tags).toEqual(["test"]);
  });

  it("should allow optional previewImage on TemplateMetadata", () => {
    const withPreview: TemplateMetadata = {
      id: "test",
      name: "Test",
      description: "Desc",
      purpose: "contest",
      tags: [],
      previewImage: "https://example.com/img.png",
    };

    expect(withPreview.previewImage).toBe("https://example.com/img.png");

    const withoutPreview: TemplateMetadata = {
      id: "test",
      name: "Test",
      description: "Desc",
      purpose: "link-in-bio",
      tags: [],
    };

    expect(withoutPreview.previewImage).toBeUndefined();
  });

  it("should allow all valid TemplatePurpose values", () => {
    const purposes: TemplatePurpose[] = ["link-in-bio", "campaign-landing", "poll", "contest"];

    expect(purposes).toHaveLength(4);
  });

  it("should allow creating a Template object with code", () => {
    const template: Template = {
      id: "t",
      name: "T",
      description: "D",
      purpose: "poll",
      tags: [],
      code: "export default function() { return null; }",
    };

    expect(template.code).toContain("export default");
  });
});

// ---------------------------------------------------------------------------
// Helper to validate TemplateMetadata shape
// ---------------------------------------------------------------------------
function expectValidMetadata(
  metadata: TemplateMetadata,
  expectedId: string,
  expectedPurpose: TemplatePurpose,
) {
  expect(metadata.id).toBe(expectedId);
  expect(typeof metadata.name).toBe("string");
  expect(metadata.name.length).toBeGreaterThan(0);
  expect(typeof metadata.description).toBe("string");
  expect(metadata.description.length).toBeGreaterThan(0);
  expect(metadata.purpose).toBe(expectedPurpose);
  expect(Array.isArray(metadata.tags)).toBe(true);
  expect(metadata.tags.length).toBeGreaterThan(0);
  for (const tag of metadata.tags) {
    expect(typeof tag).toBe("string");
    expect(tag.length).toBeGreaterThan(0);
  }
}

// ---------------------------------------------------------------------------
// Campaign Landing
// ---------------------------------------------------------------------------
describe("campaign-landing/code", () => {
  it("should export a non-empty string", () => {
    expect(typeof campaignLandingCode).toBe("string");
    expect(campaignLandingCode.length).toBeGreaterThan(0);
  });

  it("should contain a React component", () => {
    expect(campaignLandingCode).toContain("export default function");
  });

  it("should contain campaign-relevant content", () => {
    expect(campaignLandingCode).toContain("email");
    expect(campaignLandingCode).toContain("handleSubmit");
  });
});

describe("campaign-landing/metadata", () => {
  it("should have the correct shape and values", () => {
    expectValidMetadata(campaignLandingMetadata, "campaign-landing", "campaign-landing");
  });

  it("should have a descriptive name", () => {
    expect(campaignLandingMetadata.name).toBe("Campaign Landing Page");
  });

  it("should include marketing-related tags", () => {
    expect(campaignLandingMetadata.tags).toContain("marketing");
    expect(campaignLandingMetadata.tags).toContain("campaign");
  });
});

// ---------------------------------------------------------------------------
// Contest Entry
// ---------------------------------------------------------------------------
describe("contest-entry/code", () => {
  it("should export a non-empty string", () => {
    expect(typeof contestEntryCode).toBe("string");
    expect(contestEntryCode.length).toBeGreaterThan(0);
  });

  it("should contain a React component", () => {
    expect(contestEntryCode).toContain("export default function");
  });

  it("should contain form-related content", () => {
    expect(contestEntryCode).toContain("handleSubmit");
    expect(contestEntryCode).toContain("validate");
  });
});

describe("contest-entry/metadata", () => {
  it("should have the correct shape and values", () => {
    expectValidMetadata(contestEntryMetadata, "contest-entry", "contest");
  });

  it("should have a descriptive name", () => {
    expect(contestEntryMetadata.name).toBe("Contest Entry Form");
  });

  it("should include contest-related tags", () => {
    expect(contestEntryMetadata.tags).toContain("contest");
    expect(contestEntryMetadata.tags).toContain("form");
  });
});

// ---------------------------------------------------------------------------
// Interactive Poll
// ---------------------------------------------------------------------------
describe("interactive-poll/code", () => {
  it("should export a non-empty string", () => {
    expect(typeof interactivePollCode).toBe("string");
    expect(interactivePollCode.length).toBeGreaterThan(0);
  });

  it("should contain a React component", () => {
    expect(interactivePollCode).toContain("export default function");
  });

  it("should contain poll-related content", () => {
    expect(interactivePollCode).toContain("handleVote");
    expect(interactivePollCode).toContain("getPercentage");
  });
});

describe("interactive-poll/metadata", () => {
  it("should have the correct shape and values", () => {
    expectValidMetadata(interactivePollMetadata, "interactive-poll", "poll");
  });

  it("should have a descriptive name", () => {
    expect(interactivePollMetadata.name).toBe("Interactive Poll");
  });

  it("should include poll-related tags", () => {
    expect(interactivePollMetadata.tags).toContain("poll");
    expect(interactivePollMetadata.tags).toContain("voting");
  });
});

// ---------------------------------------------------------------------------
// Link-in-Bio
// ---------------------------------------------------------------------------
describe("link-in-bio/code", () => {
  it("should export a non-empty string", () => {
    expect(typeof linkInBioCode).toBe("string");
    expect(linkInBioCode.length).toBeGreaterThan(0);
  });

  it("should contain a React component", () => {
    expect(linkInBioCode).toContain("export default function");
  });

  it("should contain link-related content", () => {
    expect(linkInBioCode).toContain("links");
    expect(linkInBioCode).toContain("profileName");
  });
});

describe("link-in-bio/metadata", () => {
  it("should have the correct shape and values", () => {
    expectValidMetadata(linkInBioMetadata, "link-in-bio", "link-in-bio");
  });

  it("should have a descriptive name", () => {
    expect(linkInBioMetadata.name).toBe("Link-in-Bio Page");
  });

  it("should include social-media-related tags", () => {
    expect(linkInBioMetadata.tags).toContain("social-media");
    expect(linkInBioMetadata.tags).toContain("links");
  });
});

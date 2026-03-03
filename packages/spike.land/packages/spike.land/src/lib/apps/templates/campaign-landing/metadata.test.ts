import { describe, expect, it } from "vitest";
import { campaignLandingMetadata } from "./metadata";

describe("campaign-landing/metadata", () => {
  it("should have id 'campaign-landing'", () => {
    expect(campaignLandingMetadata.id).toBe("campaign-landing");
  });

  it("should have a name", () => {
    expect(campaignLandingMetadata.name).toBe("Campaign Landing Page");
  });

  it("should have purpose 'campaign-landing'", () => {
    expect(campaignLandingMetadata.purpose).toBe("campaign-landing");
  });

  it("should have marketing-related tags", () => {
    expect(campaignLandingMetadata.tags).toContain("marketing");
    expect(campaignLandingMetadata.tags).toContain("landing-page");
  });

  it("should have a description", () => {
    expect(campaignLandingMetadata.description.length).toBeGreaterThan(0);
  });
});

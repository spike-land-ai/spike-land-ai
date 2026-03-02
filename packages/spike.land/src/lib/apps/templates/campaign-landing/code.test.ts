import { describe, expect, it } from "vitest";
import { campaignLandingCode } from "./code";

describe("campaign-landing/code", () => {
  it("should export a non-empty string template", () => {
    expect(typeof campaignLandingCode).toBe("string");
    expect(campaignLandingCode.length).toBeGreaterThan(0);
  });

  it("should contain a React component", () => {
    expect(campaignLandingCode).toContain("export default function");
    expect(campaignLandingCode).toContain("CampaignLanding");
  });

  it("should include email input field", () => {
    expect(campaignLandingCode).toContain('type="email"');
  });

  it("should use useState hook", () => {
    expect(campaignLandingCode).toContain("useState");
  });

  it("should include form submission handler", () => {
    expect(campaignLandingCode).toContain("handleSubmit");
  });
});

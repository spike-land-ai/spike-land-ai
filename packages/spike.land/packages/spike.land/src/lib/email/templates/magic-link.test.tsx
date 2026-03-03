import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import { MagicLinkEmail } from "./magic-link";

describe("MagicLinkEmail", () => {
  const defaultProps = {
    url: "https://spike.land/api/auth/callback/email?token=abc123",
    host: "spike.land",
  };

  it("renders without errors", () => {
    const element = MagicLinkEmail(defaultProps);
    expect(element).toBeTruthy();
  });

  it("contains the sign-in URL", async () => {
    const html = await render(MagicLinkEmail(defaultProps));
    expect(html).toContain(defaultProps.url);
  });

  it("contains the host name in preview text", async () => {
    const html = await render(MagicLinkEmail(defaultProps));
    expect(html).toContain("spike.land");
  });

  it("contains the CTA button", async () => {
    const html = await render(MagicLinkEmail(defaultProps));
    expect(html).toContain("Sign in to Spike Land");
  });

  it("contains expiry disclosure", async () => {
    const html = await render(MagicLinkEmail(defaultProps));
    expect(html).toContain("10 minutes");
  });

  it("contains security note about ignoring", async () => {
    const html = await render(MagicLinkEmail(defaultProps));
    expect(html).toContain("didn&#x27;t request");
  });

  it("contains fallback URL text", async () => {
    const html = await render(MagicLinkEmail(defaultProps));
    expect(html).toContain("button doesn");
  });
});

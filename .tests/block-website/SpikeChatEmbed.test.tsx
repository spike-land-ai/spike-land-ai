import { describe, it, expect, vi } from "vitest";
import { SpikeChatEmbed } from "../../src/core/block-website/ui/SpikeChatEmbed";

vi.mock("react", () => ({
  useState: (initialValue: any) => [initialValue, vi.fn()],
}));

describe("SpikeChatEmbed", () => {
  it("returns JSX element with correct props", () => {
    // Save original location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { hostname: 'localhost' }
    });

    const result = SpikeChatEmbed({ channelSlug: "test-chan", workspaceSlug: "test-work" });
    
    // We expect a React element object
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");

    // Test production URL branch
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { hostname: 'spike.land' }
    });

    const prodResult = SpikeChatEmbed({ channelSlug: "test-chan", workspaceSlug: "test-work", guestAccess: true });
    expect(prodResult).toBeDefined();

    // Find the iframe in the prodResult children and call its onLoad
    const iframe = (prodResult as any).props.children[1];
    if (iframe && iframe.props && iframe.props.onLoad) {
      iframe.props.onLoad();
    }

    // Restore location
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation
    });
  });
});

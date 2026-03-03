import { describe, expect, it } from "vitest";
import {
  buildAgentSystemPrompt,
  getAgentChatConfig,
} from "./agent-system-prompt";

describe("buildAgentSystemPrompt", () => {
  it("includes user name when provided", () => {
    const prompt = buildAgentSystemPrompt({
      route: "/store",
      isAuthenticated: true,
      userName: "Alice",
    });
    expect(prompt).toContain("Alice");
    expect(prompt).toContain("signed in");
  });

  it("shows signed-in message when authenticated without name", () => {
    const prompt = buildAgentSystemPrompt({
      route: "/store",
      isAuthenticated: true,
    });
    expect(prompt).toContain("signed in (name unknown)");
  });

  it("shows not-signed-in message when unauthenticated", () => {
    const prompt = buildAgentSystemPrompt({
      route: "/store",
      isAuthenticated: false,
    });
    expect(prompt).toContain("not signed in");
  });

  it("includes page title when provided", () => {
    const prompt = buildAgentSystemPrompt({
      route: "/store",
      isAuthenticated: false,
      pageTitle: "App Store",
    });
    expect(prompt).toContain("App Store");
    expect(prompt).toContain("/store");
  });

  it("shows route without page title when not provided", () => {
    const prompt = buildAgentSystemPrompt({
      route: "/settings",
      isAuthenticated: false,
    });
    expect(prompt).toContain("`/settings`");
    expect(prompt).not.toContain("**undefined**");
  });

  it("includes intent detection sections", () => {
    const prompt = buildAgentSystemPrompt({
      route: "/",
      isAuthenticated: false,
    });
    expect(prompt).toContain("Bug Report");
    expect(prompt).toContain("Feature Request");
    expect(prompt).toContain("Private Message");
    expect(prompt).toContain("Page Review");
    expect(prompt).toContain("Navigation Help");
    expect(prompt).toContain("General Question");
  });

  it("includes tool references", () => {
    const prompt = buildAgentSystemPrompt({
      route: "/",
      isAuthenticated: false,
    });
    expect(prompt).toContain("github_issue_search");
    expect(prompt).toContain("github_create_issue");
    expect(prompt).toContain("dm_send");
    expect(prompt).toContain("page_review");
  });

  it("embeds the current route in page_review instruction", () => {
    const prompt = buildAgentSystemPrompt({
      route: "/my-page",
      isAuthenticated: false,
    });
    expect(prompt).toContain("`/my-page`");
  });
});

describe("getAgentChatConfig", () => {
  it("returns config with correct title and placeholder", () => {
    const config = getAgentChatConfig("/store", true);
    expect(config.chatTitle).toBe("spike.land Agent");
    expect(config.placeholder).toContain("report bugs");
    expect(config.allowTools).toBe(true);
  });

  it("always allows tools regardless of auth", () => {
    const config = getAgentChatConfig("/store", false);
    expect(config.allowTools).toBe(true);
  });

  it("generates a system prompt", () => {
    const config = getAgentChatConfig("/create", true);
    expect(config.systemPrompt).toContain("spike.land Agent");
    expect(config.systemPrompt).toContain("/create");
  });
});

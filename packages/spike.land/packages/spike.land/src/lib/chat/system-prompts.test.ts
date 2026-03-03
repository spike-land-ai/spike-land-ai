import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/bazdmeg/system-prompt", () => ({
  BAZDMEG_SYSTEM_PROMPT: "BAZDMEG_MOCK_PROMPT",
}));

import { getChatConfig } from "./system-prompts";

describe("getChatConfig", () => {
  describe("bazdmeg routes", () => {
    it("returns BAZDMEG config for /bazdmeg", () => {
      const config = getChatConfig("/bazdmeg", false);
      expect(config.systemPrompt).toBe("BAZDMEG_MOCK_PROMPT");
      expect(config.chatTitle).toBe("BAZDMEG Assistant");
      expect(config.placeholder).toContain("BAZDMEG");
      expect(config.allowTools).toBe(false);
    });

    it("returns BAZDMEG config for /bazdmeg/chat sub-route", () => {
      const config = getChatConfig("/bazdmeg/chat", true);
      expect(config.systemPrompt).toBe("BAZDMEG_MOCK_PROMPT");
      expect(config.allowTools).toBe(false);
    });
  });

  describe("create routes", () => {
    it("returns create config for /create", () => {
      const config = getChatConfig("/create", false);
      expect(config.chatTitle).toBe("Code Assistant");
      expect(config.systemPrompt).toContain("Code Assistant");
      expect(config.allowTools).toBe(false);
    });

    it("allows tools when logged in on /create", () => {
      const config = getChatConfig("/create", true);
      expect(config.allowTools).toBe(true);
    });

    it("disables tools when not logged in on /create", () => {
      const config = getChatConfig("/create/my-app", false);
      expect(config.allowTools).toBe(false);
    });
  });

  describe("general routes", () => {
    it("returns general config for /", () => {
      const config = getChatConfig("/", false);
      expect(config.chatTitle).toBe("Ask spike.land");
      expect(config.systemPrompt).toContain("spike.land");
      expect(config.allowTools).toBe(false);
    });

    it("returns general config for unknown routes", () => {
      const config = getChatConfig("/some-page", true);
      expect(config.chatTitle).toBe("Ask spike.land");
      expect(config.allowTools).toBe(false);
    });
  });

  it("all configs have required fields", () => {
    const routes = ["/", "/bazdmeg", "/create", "/store"];
    for (const route of routes) {
      const config = getChatConfig(route, false);
      expect(config.systemPrompt).toBeTruthy();
      expect(config.chatTitle).toBeTruthy();
      expect(config.placeholder).toBeTruthy();
      expect(typeof config.allowTools).toBe("boolean");
    }
  });
});

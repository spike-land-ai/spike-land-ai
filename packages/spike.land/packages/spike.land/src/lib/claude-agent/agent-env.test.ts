import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/token-pool", () => ({
  getPreferredToken: vi.fn(),
}));

import { getPreferredToken } from "@/lib/ai/token-pool";
import { agentEnv } from "./agent-env";

const mockGetPreferredToken = vi.mocked(getPreferredToken);

describe("agent-env", () => {
  describe("agentEnv", () => {
    it("should strip CLAUDECODE from environment", () => {
      process.env["CLAUDECODE"] = "true";
      const env = agentEnv();
      expect(env["CLAUDECODE"]).toBeUndefined();
      delete process.env["CLAUDECODE"];
    });

    it("should inject CLAUDE_CODE_OAUTH_TOKEN when token exists", () => {
      mockGetPreferredToken.mockReturnValue("test-token-123");
      const env = agentEnv();
      expect(env["CLAUDE_CODE_OAUTH_TOKEN"]).toBe("test-token-123");
    });

    it("should not add extra CLAUDE_CODE_OAUTH_TOKEN when no token", () => {
      const originalToken = process.env["CLAUDE_CODE_OAUTH_TOKEN"];
      delete process.env["CLAUDE_CODE_OAUTH_TOKEN"];
      mockGetPreferredToken.mockReturnValue("");
      const env = agentEnv();
      expect(env["CLAUDE_CODE_OAUTH_TOKEN"]).toBeUndefined();
      // Restore
      if (originalToken) {
        process.env["CLAUDE_CODE_OAUTH_TOKEN"] = originalToken;
      }
    });

    it("should preserve existing process.env variables", () => {
      process.env["TEST_VAR_AGENT_ENV"] = "hello";
      mockGetPreferredToken.mockReturnValue("");
      const env = agentEnv();
      expect(env["TEST_VAR_AGENT_ENV"]).toBe("hello");
      delete process.env["TEST_VAR_AGENT_ENV"];
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateIssue = vi.hoisted(() => vi.fn());

vi.mock("@/lib/agents/github-issues", () => ({
  createIssue: mockCreateIssue,
}));

vi.mock("@/lib/logger", () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { createGenerationTicket, updateTicketStatus } from "./ticket-service";

describe("ticket-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGenerationTicket", () => {
    it("creates GitHub issue", async () => {
      mockCreateIssue.mockResolvedValue({ data: { number: 42 } });

      const result = await createGenerationTicket(
        "cooking/thai-curry",
        "/cooking/thai-curry",
        "food",
      );

      expect(result.githubIssueNumber).toBe(42);
    });

    it("handles GitHub failure gracefully", async () => {
      mockCreateIssue.mockRejectedValue(new Error("GitHub down"));

      const result = await createGenerationTicket("test", "/test", null);

      expect(result.githubIssueNumber).toBeNull();
    });
  });

  describe("updateTicketStatus", () => {
    it("resolves without error for null ticket IDs", async () => {
      await expect(
        updateTicketStatus(null, "CODING"),
      ).resolves.toBeUndefined();
    });

    it("resolves without error for terminal phases", async () => {
      await expect(
        updateTicketStatus(42, "PUBLISHED"),
      ).resolves.toBeUndefined();
    });
  });
});

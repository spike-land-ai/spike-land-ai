import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockGet,
  }),
}));

import { getPersonaCookie } from "./get-persona-cookie.server";

describe("get-persona-cookie.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPersonaCookie (server)", () => {
    it("returns the persona slug when cookie is set", async () => {
      mockGet.mockReturnValue({ value: "ai-indie" });
      const result = await getPersonaCookie();
      expect(result).toBe("ai-indie");
      expect(mockGet).toHaveBeenCalledWith("spike-persona");
    });

    it("returns null when cookie is not set", async () => {
      mockGet.mockReturnValue(undefined);
      const result = await getPersonaCookie();
      expect(result).toBeNull();
    });
  });
});

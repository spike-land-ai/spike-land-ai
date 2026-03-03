import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    app: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
    createdApp: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

// Mock codespace
const mockGetOrCreateSession = vi.fn();
vi.mock("@/lib/codespace", () => ({
  getOrCreateSession: (...args: unknown[]) => mockGetOrCreateSession(...args),
}));

import {
  appIncludeOptions,
  checkCodespaceHasContent,
  findAppByIdentifier,
  findAppByIdentifierSimple,
  findCreatedAppByCodespace,
} from "./app-lookup";

describe("app-lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("appIncludeOptions", () => {
    it("should include requirements ordered by createdAt asc", () => {
      expect(appIncludeOptions.requirements.orderBy).toEqual({
        createdAt: "asc",
      });
    });

    it("should include monetizationModels ordered by createdAt asc", () => {
      expect(appIncludeOptions.monetizationModels.orderBy).toEqual({
        createdAt: "asc",
      });
    });

    it("should include statusHistory limited to 10, ordered desc", () => {
      expect(appIncludeOptions.statusHistory.take).toBe(10);
      expect(appIncludeOptions.statusHistory.orderBy).toEqual({
        createdAt: "desc",
      });
    });

    it("should include counts for messages and images", () => {
      expect(appIncludeOptions._count.select).toEqual({
        messages: true,
        images: true,
      });
    });
  });

  describe("findAppByIdentifier", () => {
    const userId = "user-123";
    const fakeApp = { id: "app-1", name: "My App", codespaceId: "my-app" };

    it("should find app by codespaceId first", async () => {
      mockFindFirst.mockResolvedValueOnce(fakeApp);

      const result = await findAppByIdentifier("my-app", userId);

      expect(result).toEqual(fakeApp);
      expect(mockFindFirst).toHaveBeenCalledTimes(1);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ codespaceId: "my-app", userId }),
        }),
      );
    });

    it("should fall back to slug lookup", async () => {
      mockFindFirst
        .mockResolvedValueOnce(null) // codespaceId miss
        .mockResolvedValueOnce(fakeApp); // slug hit

      const result = await findAppByIdentifier("my-slug", userId);

      expect(result).toEqual(fakeApp);
      expect(mockFindFirst).toHaveBeenCalledTimes(2);
    });

    it("should fall back to cuid lookup for cuid-like identifiers", async () => {
      const cuid = "clh1234567890abcdefghij";
      mockFindFirst
        .mockResolvedValueOnce(null) // codespaceId miss
        .mockResolvedValueOnce(null) // slug miss
        .mockResolvedValueOnce(fakeApp); // id hit

      const result = await findAppByIdentifier(cuid, userId);

      expect(result).toEqual(fakeApp);
      expect(mockFindFirst).toHaveBeenCalledTimes(3);
      expect(mockFindFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: cuid }),
        }),
      );
    });

    it("should NOT attempt cuid lookup for non-cuid identifiers", async () => {
      mockFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await findAppByIdentifier("regular-slug", userId);

      expect(result).toBeNull();
      // Only 2 calls: codespaceId + slug, no id lookup
      expect(mockFindFirst).toHaveBeenCalledTimes(2);
    });

    it("should return null when no match found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await findAppByIdentifier("nonexistent", userId);

      expect(result).toBeNull();
    });
  });

  describe("findAppByIdentifierSimple", () => {
    const userId = "user-456";

    it("should find app by codespaceId", async () => {
      const app = { id: "app-2", codespaceId: "simple-app" };
      mockFindFirst.mockResolvedValueOnce(app);

      const result = await findAppByIdentifierSimple("simple-app", userId);

      expect(result).toEqual(app);
    });

    it("should fall back to slug", async () => {
      mockFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "app-2" });

      const result = await findAppByIdentifierSimple("my-slug", userId);

      expect(result).toEqual({ id: "app-2" });
    });

    it("should fall back to cuid for cuid-like identifiers", async () => {
      const cuid = "clh1234567890abcdefghij";
      mockFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "found" });

      const result = await findAppByIdentifierSimple(cuid, userId);

      expect(result).toEqual({ id: "found" });
    });

    it("should not use include options (simple)", async () => {
      mockFindFirst.mockResolvedValueOnce({ id: "app-1" });

      await findAppByIdentifierSimple("app-1", userId);

      const callArgs = mockFindFirst.mock.calls[0]![0] as Record<string, unknown>;
      expect(callArgs).not.toHaveProperty("include");
    });
  });

  describe("checkCodespaceHasContent", () => {
    it("should return true when codespace has non-default content", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        html: "<div>Real content here</div>",
      });

      const result = await checkCodespaceHasContent("my-space");

      expect(result).toBe(true);
      expect(mockGetOrCreateSession).toHaveBeenCalledWith("my-space");
    });

    it("should return false for default placeholder content", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        html: "<div>Write your code here!</div>",
      });

      const result = await checkCodespaceHasContent("empty-space");

      expect(result).toBe(false);
    });

    it("should return false when session retrieval fails", async () => {
      mockGetOrCreateSession.mockRejectedValue(new Error("Not found"));

      const result = await checkCodespaceHasContent("broken-space");

      expect(result).toBe(false);
    });

    it("should trim whitespace when comparing", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        html: "  <div>Write your code here!</div>  ",
      });

      const result = await checkCodespaceHasContent("padded-space");

      expect(result).toBe(false);
    });
  });

  describe("findCreatedAppByCodespace", () => {
    it("should find a published created app", async () => {
      const createdApp = { id: "ca-1", codespaceId: "my-cs" };
      mockFindFirst.mockResolvedValue(createdApp);

      const result = await findCreatedAppByCodespace("my-cs", "user-1");

      expect(result).toEqual(createdApp);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            codespaceId: "my-cs",
            generatedById: "user-1",
            status: "PUBLISHED",
          },
        }),
      );
    });

    it("should return null when not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await findCreatedAppByCodespace("missing", "user-1");

      expect(result).toBeNull();
    });
  });
});

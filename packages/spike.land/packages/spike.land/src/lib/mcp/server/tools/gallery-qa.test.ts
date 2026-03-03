import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  user: { findFirst: vi.fn() },
  album: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerGalleryTools } from "./gallery";

describe("Gallery Showcase QA", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerGalleryTools(registry, userId);
  });

  it("should return empty list when no public albums found for super admin", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "admin-1" });
    mockPrisma.album.findMany.mockResolvedValue([]);

    const handler = registry.handlers.get("gallery_showcase")!;
    const result = await handler({ view: "albums" });

    const data = JSON.parse(getText(result));
    expect(data.items).toEqual([]);
  });
});

import { describe, expect, it, vi } from "vitest";

const { mockAlbumFindMany, mockAlbumCreateMany, mockAlbumFindFirst } = vi.hoisted(() => ({
  mockAlbumFindMany: vi.fn(),
  mockAlbumCreateMany: vi.fn(),
  mockAlbumFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    album: {
      findMany: mockAlbumFindMany,
      createMany: mockAlbumCreateMany,
      findFirst: mockAlbumFindFirst,
    },
  },
}));

import {
  ensureUserAlbums,
  getOrCreatePrivateAlbum,
  getOrCreatePublicAlbum,
} from "./ensure-user-albums";

const PRIVATE_ALBUM = {
  id: "private-1",
  userId: "user-1",
  name: "Private Gallery",
  privacy: "PRIVATE",
  defaultTier: "TIER_1K",
  description: "My private photos",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PUBLIC_ALBUM = {
  id: "public-1",
  userId: "user-1",
  name: "Public Gallery",
  privacy: "PUBLIC",
  defaultTier: "TIER_1K",
  description: "My public enhancements",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ensureUserAlbums", () => {
  beforeEach(() => {
    mockAlbumFindMany.mockReset();
    mockAlbumCreateMany.mockReset();
    mockAlbumFindFirst.mockReset();
  });

  it("returns existing private and public albums when both exist", async () => {
    mockAlbumFindMany.mockResolvedValue([PRIVATE_ALBUM, PUBLIC_ALBUM]);

    const result = await ensureUserAlbums("user-1");
    expect(result.privateAlbum.id).toBe("private-1");
    expect(result.publicAlbum.id).toBe("public-1");
    expect(mockAlbumCreateMany).not.toHaveBeenCalled();
  });

  it("creates both albums when none exist", async () => {
    mockAlbumFindMany.mockResolvedValue([]);
    mockAlbumCreateMany.mockResolvedValue({ count: 2 });
    mockAlbumFindFirst
      .mockResolvedValueOnce(PRIVATE_ALBUM)
      .mockResolvedValueOnce(PUBLIC_ALBUM);

    const result = await ensureUserAlbums("user-1");
    expect(mockAlbumCreateMany).toHaveBeenCalledOnce();
    expect(result.privateAlbum.id).toBe("private-1");
    expect(result.publicAlbum.id).toBe("public-1");
  });

  it("creates only missing private album when public exists", async () => {
    mockAlbumFindMany.mockResolvedValue([PUBLIC_ALBUM]);
    mockAlbumCreateMany.mockResolvedValue({ count: 1 });
    mockAlbumFindFirst.mockResolvedValueOnce(PRIVATE_ALBUM);

    const result = await ensureUserAlbums("user-1");
    expect(mockAlbumCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ privacy: "PRIVATE" }),
        ]),
      }),
    );
    expect(result.publicAlbum.id).toBe("public-1");
    expect(result.privateAlbum.id).toBe("private-1");
  });

  it("creates only missing public album when private exists", async () => {
    mockAlbumFindMany.mockResolvedValue([PRIVATE_ALBUM]);
    mockAlbumCreateMany.mockResolvedValue({ count: 1 });
    mockAlbumFindFirst.mockResolvedValueOnce(PUBLIC_ALBUM);

    const result = await ensureUserAlbums("user-1");
    expect(mockAlbumCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ privacy: "PUBLIC" }),
        ]),
      }),
    );
    expect(result.privateAlbum.id).toBe("private-1");
    expect(result.publicAlbum.id).toBe("public-1");
  });

  it("throws when findMany fails", async () => {
    mockAlbumFindMany.mockRejectedValue(new Error("DB read error"));
    await expect(ensureUserAlbums("user-1")).rejects.toThrow(
      "Failed to fetch albums for user user-1",
    );
  });

  it("throws when createMany fails", async () => {
    mockAlbumFindMany.mockResolvedValue([]);
    mockAlbumCreateMany.mockRejectedValue(new Error("Create failed"));
    await expect(ensureUserAlbums("user-1")).rejects.toThrow(
      "Failed to create albums for user user-1",
    );
  });

  it("throws when findFirst fails during final fetch", async () => {
    mockAlbumFindMany.mockResolvedValue([]);
    mockAlbumCreateMany.mockResolvedValue({ count: 2 });
    mockAlbumFindFirst.mockRejectedValue(new Error("Find error"));
    await expect(ensureUserAlbums("user-1")).rejects.toThrow(
      "Failed to fetch albums for user user-1",
    );
  });

  it("throws when private album not found after creation", async () => {
    mockAlbumFindMany.mockResolvedValue([]);
    mockAlbumCreateMany.mockResolvedValue({ count: 2 });
    mockAlbumFindFirst
      .mockResolvedValueOnce(null) // private not found
      .mockResolvedValueOnce(PUBLIC_ALBUM);
    await expect(ensureUserAlbums("user-1")).rejects.toThrow(
      "Failed to ensure albums for user user-1",
    );
  });
});

describe("getOrCreatePrivateAlbum", () => {
  beforeEach(() => {
    mockAlbumFindMany.mockReset();
    mockAlbumCreateMany.mockReset();
    mockAlbumFindFirst.mockReset();
  });

  it("returns the private album", async () => {
    mockAlbumFindMany.mockResolvedValue([PRIVATE_ALBUM, PUBLIC_ALBUM]);
    const result = await getOrCreatePrivateAlbum("user-1");
    expect(result.id).toBe("private-1");
  });
});

describe("getOrCreatePublicAlbum", () => {
  beforeEach(() => {
    mockAlbumFindMany.mockReset();
    mockAlbumCreateMany.mockReset();
    mockAlbumFindFirst.mockReset();
  });

  it("returns the public album", async () => {
    mockAlbumFindMany.mockResolvedValue([PRIVATE_ALBUM, PUBLIC_ALBUM]);
    const result = await getOrCreatePublicAlbum("user-1");
    expect(result.id).toBe("public-1");
  });
});

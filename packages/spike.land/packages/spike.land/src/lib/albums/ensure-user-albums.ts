import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import type { Album } from "@prisma/client";

const DEFAULT_PRIVATE_ALBUM = {
  name: "Private Gallery",
  privacy: "PRIVATE" as const,
  defaultTier: "TIER_1K" as const,
  description: "My private photos",
};

const DEFAULT_PUBLIC_ALBUM = {
  name: "Public Gallery",
  privacy: "PUBLIC" as const,
  defaultTier: "TIER_1K" as const,
  description: "My public enhancements",
};

interface UserAlbums {
  privateAlbum: Album;
  publicAlbum: Album;
}

/**
 * Ensures a user has both a private and public gallery album.
 * Creates missing albums if they don't exist.
 *
 * @param userId - The user's ID
 * @returns Object containing both the private and public album
 */
export async function ensureUserAlbums(userId: string): Promise<UserAlbums> {
  // Find existing albums for this user
  const { data: existingAlbums, error: findError } = await tryCatch(
    prisma.album.findMany({
      where: { userId },
    }),
  );

  if (findError) {
    throw new Error(
      `Failed to fetch albums for user ${userId}: ${findError.message}`,
    );
  }

  const existingPrivate = existingAlbums.find(
    a => a.privacy === "PRIVATE" && a.name === DEFAULT_PRIVATE_ALBUM.name,
  );
  const existingPublic = existingAlbums.find(
    a => a.privacy === "PUBLIC" && a.name === DEFAULT_PUBLIC_ALBUM.name,
  );

  // Create missing albums
  const albumsToCreate: Array<{
    userId: string;
    name: string;
    privacy: "PRIVATE" | "PUBLIC";
    defaultTier: "TIER_1K" | "TIER_2K" | "TIER_4K";
    description: string;
  }> = [];

  if (!existingPrivate) {
    albumsToCreate.push({
      userId,
      ...DEFAULT_PRIVATE_ALBUM,
    });
  }

  if (!existingPublic) {
    albumsToCreate.push({
      userId,
      ...DEFAULT_PUBLIC_ALBUM,
    });
  }

  // Batch create missing albums
  if (albumsToCreate.length > 0) {
    const { error: createError } = await tryCatch(
      prisma.album.createMany({
        data: albumsToCreate,
        skipDuplicates: true,
      }),
    );

    if (createError) {
      throw new Error(
        `Failed to create albums for user ${userId}: ${createError.message}`,
      );
    }
  }

  // Fetch the final albums
  const { data: albums, error: fetchError } = await tryCatch(
    Promise.all([
      existingPrivate
        ? Promise.resolve(existingPrivate)
        : prisma.album.findFirst({
          where: {
            userId,
            privacy: "PRIVATE",
            name: DEFAULT_PRIVATE_ALBUM.name,
          },
        }),
      existingPublic
        ? Promise.resolve(existingPublic)
        : prisma.album.findFirst({
          where: {
            userId,
            privacy: "PUBLIC",
            name: DEFAULT_PUBLIC_ALBUM.name,
          },
        }),
    ]),
  );

  if (fetchError) {
    throw new Error(
      `Failed to fetch albums for user ${userId}: ${fetchError.message}`,
    );
  }

  const [privateAlbum, publicAlbum] = albums;

  if (!privateAlbum || !publicAlbum) {
    throw new Error(`Failed to ensure albums for user ${userId}`);
  }

  return { privateAlbum, publicAlbum };
}

/**
 * Gets the user's private gallery album, creating it if it doesn't exist.
 */
export async function getOrCreatePrivateAlbum(userId: string): Promise<Album> {
  const { privateAlbum } = await ensureUserAlbums(userId);
  return privateAlbum;
}

/**
 * Gets the user's public gallery album, creating it if it doesn't exist.
 */
export async function getOrCreatePublicAlbum(userId: string): Promise<Album> {
  const { publicAlbum } = await ensureUserAlbums(userId);
  return publicAlbum;
}

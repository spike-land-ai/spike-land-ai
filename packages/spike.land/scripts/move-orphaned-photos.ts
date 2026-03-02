import { AlbumPrivacy } from "@prisma/client";
import prisma from "../src/lib/prisma";

// This script moves all orphaned photos (not in any album) for a specific user to a "Private Backup" album.
// Usage: npx tsx scripts/move-orphaned-photos.ts <email>

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide an email address.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  console.log(`Found user: ${user.id} (${user.email})`);

  // Find all enhanced images for this user
  const allImages = await prisma.enhancedImage.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  // Find all images that are in ANY album
  const albumImages = await prisma.albumImage.findMany({
    where: {
      image: {
        userId: user.id,
      },
    },
    select: { imageId: true },
  });

  const albumImageIds = new Set(albumImages.map((ai) => ai.imageId));
  const orphanedImageIds = allImages.filter((img) => !albumImageIds.has(img.id)).map((i) => i.id);

  console.log(`Found ${orphanedImageIds.length} orphaned images.`);

  if (orphanedImageIds.length === 0) {
    console.log("No orphaned images to move.");
    return;
  }

  // Find or create 'Private Backup' or 'My Private Album'
  let targetAlbum = await prisma.album.findFirst({
    where: {
      userId: user.id,
      name: "Private Backup",
    },
  });

  if (!targetAlbum) {
    console.log("Creating 'Private Backup' album...");
    // Get max sort order
    const maxSort = await prisma.album.aggregate({
      where: { userId: user.id },
      _max: { sortOrder: true },
    });

    targetAlbum = await prisma.album.create({
      data: {
        userId: user.id,
        name: "Private Backup",
        privacy: AlbumPrivacy.PRIVATE,
        defaultTier: "TIER_1K", // Default
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
  }

  console.log(`Moving images to album: ${targetAlbum.name} (${targetAlbum.id})`);

  // Move images
  let movedCount = 0;
  // Get max sort order in this album
  const maxAlbumSort = await prisma.albumImage.aggregate({
    where: { albumId: targetAlbum.id },
    _max: { sortOrder: true },
  });
  let currentSort = (maxAlbumSort._max.sortOrder ?? -1) + 1;

  for (const imageId of orphanedImageIds) {
    await prisma.albumImage.create({
      data: {
        albumId: targetAlbum.id,
        imageId: imageId,
        sortOrder: currentSort++,
      },
    });
    movedCount++;
  }

  console.log(`Successfully moved ${movedCount} images.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

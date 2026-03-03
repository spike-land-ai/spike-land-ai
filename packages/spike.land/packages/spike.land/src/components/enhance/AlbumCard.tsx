"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Globe, Images, Link as LinkIcon, Lock } from "lucide-react";
import Image from "next/image";

interface PreviewImage {
  id: string;
  url: string;
  name: string;
}

interface Album {
  id: string;
  name: string;
  privacy: "PRIVATE" | "UNLISTED" | "PUBLIC";
  imageCount: number;
  previewImages: PreviewImage[];
}

interface AlbumCardProps {
  album: Album;
  onClick?: () => void;
  isDropTarget?: boolean;
}

function getPrivacyIcon(privacy: Album["privacy"]) {
  switch (privacy) {
    case "PUBLIC":
      return <Globe className="h-3 w-3" />;
    case "UNLISTED":
      return <LinkIcon className="h-3 w-3" />;
    default:
      return <Lock className="h-3 w-3" />;
  }
}

function getPrivacyLabel(privacy: Album["privacy"]) {
  switch (privacy) {
    case "PUBLIC":
      return "Public";
    case "UNLISTED":
      return "Unlisted";
    default:
      return "Private";
  }
}

function getGridClassName(imageCount: number, index: number): string {
  if (imageCount === 1) {
    return "col-span-2 row-span-2";
  }
  if (imageCount === 2) {
    return "row-span-2";
  }
  if (imageCount === 3 && index === 0) {
    return "row-span-2";
  }
  return "";
}

export function AlbumCard(
  { album, onClick, isDropTarget = false }: AlbumCardProps,
) {
  const handleClick = () => {
    onClick?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className="group relative"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Open album ${album.name}` : undefined}
    >
      <div
        className={cn(
          "relative aspect-square rounded-2xl overflow-hidden bg-muted/50 cursor-pointer transition-all duration-300",
          "group-hover:ring-2 group-hover:ring-primary/30",
          isDropTarget && "ring-2 ring-primary",
        )}
      >
        {album.previewImages.length > 0
          ? (
            <div className="grid grid-cols-2 gap-0.5 h-full">
              {album.previewImages.slice(0, 4).map((img, idx) => (
                <div
                  key={img.id}
                  className={cn(
                    "relative",
                    getGridClassName(album.previewImages.length, idx),
                  )}
                >
                  <Image
                    src={img.url}
                    alt={img.name || "Album image"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 17vw"
                  />
                </div>
              ))}
            </div>
          )
          : (
            <div className="flex h-full items-center justify-center">
              <Images className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        <Badge className="absolute bottom-2 left-2 gap-1 bg-black/60 text-white hover:bg-black/70 border-none backdrop-blur-[2px]">
          {getPrivacyIcon(album.privacy)}
          {getPrivacyLabel(album.privacy)}
        </Badge>

        <Badge className="absolute bottom-2 right-2 bg-black/60 text-white hover:bg-black/70 border-none backdrop-blur-[2px]">
          {album.imageCount} {album.imageCount === 1 ? "image" : "images"}
        </Badge>
      </div>

      <div className="mt-2">
        <p className="text-sm font-medium truncate" title={album.name}>
          {album.name}
        </p>
      </div>
    </div>
  );
}

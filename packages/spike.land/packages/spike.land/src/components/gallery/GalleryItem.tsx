import { Badge } from "@/components/ui/badge";
import { getBestThumbnail } from "@/lib/images/get-best-thumbnail";
import Image from "next/image";
import { memo } from "react";
import type { PublicImage } from "./types";

interface GalleryItemProps {
  image: PublicImage;
  onSelect: (image: PublicImage) => void;
}

export const GalleryItem = memo(function GalleryItem({
  image,
  onSelect,
}: GalleryItemProps) {
  if (!image) return null;

  const job = image.enhancementJobs?.[0];

  return (
    <button
      className="group relative cursor-pointer w-full border-0 p-0 m-0 bg-transparent text-left"
      onClick={() => onSelect(image)}
      type="button"
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(image);
        }
      }}
    >
      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted/30 transition-all duration-300 hover:ring-2 hover:ring-primary/20">
        <Image
          src={getBestThumbnail(image, true)}
          alt={image.description || "Gallery Image"}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {image.user?.image
                ? (
                  <Image
                    src={image.user.image}
                    width={20}
                    height={20}
                    className="rounded-full border border-white/20"
                    alt={image.user.name || "User"}
                  />
                )
                : <div className="w-5 h-5 rounded-full bg-white/20" />}
              <span className="text-xs text-white/90 font-medium truncate">
                {image.user?.name || "Anonymous"}
              </span>
            </div>
            {job?.tier && (
              <div className="flex gap-1 mt-1 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 bg-black/40 text-white border-white/20 backdrop-blur-sm"
                >
                  {job.tier.replace("TIER_", "")}
                </Badge>
                {image.tags?.slice(0, 2).map(tag => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[10px] h-5 bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border-transparent"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
});

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { memo } from "react";

interface GalleryFiltersProps {
  tags: string[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onClear: () => void;
}

export const GalleryFilters = memo(function GalleryFilters({
  tags,
  activeTags,
  onToggleTag,
  onClear,
}: GalleryFiltersProps) {
  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Popular Tags</h2>
        {activeTags.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground h-8"
          >
            Clear all <X className="ml-2 h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => {
          const isActive = activeTags.includes(tag);
          return (
            <Badge
              key={tag}
              variant={isActive ? "default" : "outline"}
              className={`cursor-pointer px-3 py-1.5 transition-all ${
                !isActive && "hover:bg-accent"
              }`}
              onClick={() => onToggleTag(tag)}
            >
              {tag}
            </Badge>
          );
        })}
      </div>
    </div>
  );
});

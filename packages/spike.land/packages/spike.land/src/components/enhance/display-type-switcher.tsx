"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { ImageIcon, Sparkles, Wand2 } from "lucide-react";

export type DisplayType = "original" | "enhanced" | "auto";

interface DisplayTypeSwitcherProps {
  value: DisplayType;
  onChange: (value: DisplayType) => void;
  className?: string;
}

export function DisplayTypeSwitcher({
  value,
  onChange,
  className,
}: DisplayTypeSwitcherProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={v => v && onChange(v as DisplayType)}
      className={cn("", className)}
    >
      <ToggleGroupItem
        value="original"
        aria-label="Show original images"
        className="gap-1 px-3"
      >
        <ImageIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Original</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="auto"
        aria-label="Auto - prefer enhanced"
        className="gap-1 px-3"
      >
        <Wand2 className="h-4 w-4" />
        <span className="hidden sm:inline">Auto</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="enhanced"
        aria-label="Show enhanced images only"
        className="gap-1 px-3"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Enhanced</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

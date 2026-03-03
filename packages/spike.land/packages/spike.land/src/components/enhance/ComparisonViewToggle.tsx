"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Columns2, SlidersHorizontal, SplitSquareVertical } from "lucide-react";
import { ImageComparisonSlider } from "./ImageComparisonSlider";
import { SideBySideComparison } from "./SideBySideComparison";
import { SplitPreview } from "./SplitPreview";

type ComparisonViewMode = "slider" | "side-by-side" | "split";

interface ComparisonViewToggleProps {
  originalUrl: string;
  enhancedUrl: string;
  width?: number;
  height?: number;
  defaultMode?: ComparisonViewMode;
  onModeChange?: (mode: ComparisonViewMode) => void;
}

export function ComparisonViewToggle({
  originalUrl,
  enhancedUrl,
  width = 16,
  height = 9,
  defaultMode = "slider",
  onModeChange,
}: ComparisonViewToggleProps) {
  const handleModeChange = (value: string) => {
    onModeChange?.(value as ComparisonViewMode);
  };

  return (
    <Tabs
      defaultValue={defaultMode}
      onValueChange={handleModeChange}
      className="w-full"
      data-testid="comparison-view"
    >
      <div className="flex justify-end mb-4">
        <TabsList>
          <TabsTrigger value="slider" className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Slider</span>
          </TabsTrigger>
          <TabsTrigger value="side-by-side" className="flex items-center gap-2">
            <Columns2 className="h-4 w-4" />
            <span className="hidden sm:inline">Side by Side</span>
          </TabsTrigger>
          <TabsTrigger value="split" className="flex items-center gap-2">
            <SplitSquareVertical className="h-4 w-4" />
            <span className="hidden sm:inline">Split</span>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="slider" className="mt-0">
        <ImageComparisonSlider
          originalUrl={originalUrl}
          enhancedUrl={enhancedUrl}
          width={width}
          height={height}
        />
      </TabsContent>
      <TabsContent value="side-by-side" className="mt-0">
        <SideBySideComparison
          originalUrl={originalUrl}
          enhancedUrl={enhancedUrl}
          width={width}
          height={height}
        />
      </TabsContent>
      <TabsContent value="split" className="mt-0">
        <SplitPreview
          originalUrl={originalUrl}
          enhancedUrl={enhancedUrl}
          width={width}
          height={height}
        />
      </TabsContent>
    </Tabs>
  );
}

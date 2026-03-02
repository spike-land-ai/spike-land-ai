"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Pipeline } from "@/hooks/usePipelines";
import { usePipelines } from "@/hooks/usePipelines";
import type { EnhancementTier } from "@prisma/client";
import { ExternalLink, Settings } from "lucide-react";

interface PipelineSelectorProps {
  /**
   * Currently selected pipeline ID (null = system default)
   */
  value: string | null;
  /**
   * Callback when selection changes
   */
  onChange: (pipelineId: string | null) => void;
  /**
   * Whether to show the "Manage Pipelines" link
   */
  showManageLink?: boolean;
  /**
   * Custom placeholder text
   */
  placeholder?: string;
  /**
   * Disable the selector
   */
  disabled?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const TIER_LABELS: Record<EnhancementTier, string> = {
  FREE: "Free",
  TIER_1K: "1K",
  TIER_2K: "2K",
  TIER_4K: "4K",
};

const TIER_COLORS: Record<EnhancementTier, string> = {
  FREE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  TIER_1K: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  TIER_2K: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  TIER_4K: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

/**
 * Pipeline selector dropdown with grouped options
 *
 * Shows pipelines grouped by:
 * - System Defaults
 * - My Pipelines
 * - Public Pipelines
 *
 * @example
 * ```tsx
 * <PipelineSelector
 *   value={pipelineId}
 *   onChange={setPipelineId}
 *   showManageLink
 * />
 * ```
 */
export function PipelineSelector({
  value,
  onChange,
  showManageLink = false,
  placeholder = "Select pipeline...",
  disabled = false,
  className,
}: PipelineSelectorProps) {
  const { groupedPipelines, isLoading, error, getPipelineById } = usePipelines();

  // Get display name for current selection
  const selectedPipeline = value ? getPipelineById(value) : null;
  const displayValue = selectedPipeline?.name || (value ? "Unknown pipeline" : null);

  if (isLoading) {
    return (
      <div className={className}>
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="text-sm text-destructive">Failed to load pipelines</div>
      </div>
    );
  }

  const hasMyPipelines = groupedPipelines.myPipelines.length > 0;
  const hasPublicPipelines = groupedPipelines.publicPipelines.length > 0;
  const hasSystemDefaults = groupedPipelines.systemDefaults.length > 0;

  return (
    <div className={className}>
      <div className="space-y-2">
        <Select
          value={value || "none"}
          onValueChange={(v) => onChange(v === "none" ? null : v)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder}>
              {value === null || value === "none" ? "System Default" : displayValue}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {/* None option - use system default */}
            <SelectItem value="none">
              <div className="flex items-center gap-2">
                <span>System Default</span>
                <Badge variant="outline" className="text-xs">
                  Auto
                </Badge>
              </div>
            </SelectItem>

            {/* System Defaults */}
            {hasSystemDefaults && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>System Defaults</SelectLabel>
                  {groupedPipelines.systemDefaults.map((pipeline) => (
                    <PipelineOption key={pipeline.id} pipeline={pipeline} />
                  ))}
                </SelectGroup>
              </>
            )}

            {/* My Pipelines */}
            {hasMyPipelines && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>My Pipelines</SelectLabel>
                  {groupedPipelines.myPipelines.map((pipeline) => (
                    <PipelineOption key={pipeline.id} pipeline={pipeline} />
                  ))}
                </SelectGroup>
              </>
            )}

            {/* Public Pipelines */}
            {hasPublicPipelines && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Public Pipelines</SelectLabel>
                  {groupedPipelines.publicPipelines.map((pipeline) => (
                    <PipelineOption key={pipeline.id} pipeline={pipeline} />
                  ))}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>

        {showManageLink && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link href="/apps/pixel/pipelines">
                <Settings className="mr-1 h-3 w-3" />
                Manage Pipelines
              </Link>
            </Button>
            {selectedPipeline && selectedPipeline.isOwner && (
              <>
                <span className="text-xs text-muted-foreground">|</span>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Link href={`/apps/pixel/pipelines/${selectedPipeline.id}`}>
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Edit Pipeline
                  </Link>
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Individual pipeline option in the dropdown
 */
function PipelineOption({ pipeline }: { pipeline: Pipeline }) {
  return (
    <SelectItem value={pipeline.id}>
      <div className="flex items-center gap-2">
        <span className="truncate">{pipeline.name}</span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${TIER_COLORS[pipeline.tier]}`}
        >
          {TIER_LABELS[pipeline.tier]}
        </Badge>
      </div>
    </SelectItem>
  );
}

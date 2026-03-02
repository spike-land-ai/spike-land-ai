import type { EnhancementTier, PipelineVisibility } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";

import { tryCatch } from "@/lib/try-catch";

import type {
  AnalysisConfig,
  AutoCropConfig,
  GenerationConfig,
  PromptConfig,
} from "@/lib/ai/pipeline-types";

/**
 * Pipeline from API response
 */
export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  userId: string | null;
  visibility: PipelineVisibility;
  tier: EnhancementTier;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  analysisConfig: AnalysisConfig | null;
  autoCropConfig: AutoCropConfig | null;
  promptConfig: PromptConfig | null;
  generationConfig: GenerationConfig | null;
  isOwner: boolean;
  isSystemDefault: boolean;
}

/**
 * Pagination metadata from API
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * API response shape for GET /api/pipelines
 */
interface PipelinesResponse {
  pipelines: Pipeline[];
  pagination: PaginationInfo;
}

/**
 * Grouped pipelines for display in UI
 */
export interface GroupedPipelines {
  /** System default pipelines (userId: null) */
  systemDefaults: Pipeline[];
  /** User's own pipelines */
  myPipelines: Pipeline[];
  /** Public pipelines from other users */
  publicPipelines: Pipeline[];
}

/**
 * Options for usePipelines hook
 */
interface UsePipelinesOptions {
  /**
   * Whether to fetch pipelines automatically (default: true)
   */
  enabled?: boolean;
}

/**
 * Return type for usePipelines hook
 */
export interface UsePipelinesReturn {
  /**
   * All pipelines (flat list)
   */
  pipelines: Pipeline[];
  /**
   * Pipelines grouped by category for UI display
   */
  groupedPipelines: GroupedPipelines;
  /**
   * Loading state for initial fetch
   */
  isLoading: boolean;
  /**
   * Loading state for pagination (loadMore)
   */
  isLoadingMore: boolean;
  /**
   * Error state (null if no error)
   */
  error: Error | null;
  /**
   * Pagination info from the API
   */
  pagination: PaginationInfo | null;
  /**
   * Whether there are more pipelines to load
   */
  hasMore: boolean;
  /**
   * Load the next page of pipelines (for infinite scroll)
   */
  loadMore: () => Promise<void>;
  /**
   * Refetch pipelines from API (resets to first page)
   */
  refetch: () => Promise<void>;
  /**
   * Get a pipeline by ID
   */
  getPipelineById: (id: string) => Pipeline | undefined;
}

/**
 * Hook for fetching user's accessible pipelines
 *
 * Returns pipelines the user can access:
 * - System default pipelines
 * - User's own pipelines
 * - Public pipelines from other users
 *
 * @param options - Configuration options
 * @returns Pipeline data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * function PipelineSelector() {
 *   const { pipelines, groupedPipelines, isLoading, error } = usePipelines();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <select>
 *       <optgroup label="System Defaults">
 *         {groupedPipelines.systemDefaults.map(p => (
 *           <option key={p.id} value={p.id}>{p.name}</option>
 *         ))}
 *       </optgroup>
 *       <optgroup label="My Pipelines">
 *         {groupedPipelines.myPipelines.map(p => (
 *           <option key={p.id} value={p.id}>{p.name}</option>
 *         ))}
 *       </optgroup>
 *     </select>
 *   );
 * }
 * ```
 */
export function usePipelines(options: UsePipelinesOptions = {}): UsePipelinesReturn {
  const { enabled = true } = options;

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const fetchPipelines = useCallback(async (page = 0, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    const fetchAndParse = async (): Promise<PipelinesResponse> => {
      const response = await fetch(`/api/pipelines?page=${page}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("You must be logged in to view pipelines");
        }
        throw new Error(`Failed to fetch pipelines: ${response.statusText}`);
      }

      return response.json();
    };

    const { data, error: fetchError } = await tryCatch(fetchAndParse());

    if (fetchError) {
      const errorMessage =
        fetchError instanceof Error ? fetchError.message : "An unknown error occurred";
      setError(new Error(errorMessage));
      if (!append) {
        setPipelines([]);
        setPagination(null);
      }
    } else {
      if (append) {
        setPipelines((prev) => [...prev, ...data.pipelines]);
      } else {
        setPipelines(data.pipelines);
      }
      setPagination(data.pagination);
    }

    if (append) {
      setIsLoadingMore(false);
    } else {
      setIsLoading(false);
    }
  }, []);

  // Load more (next page)
  const loadMore = useCallback(async () => {
    if (!pagination?.hasMore || isLoadingMore) return;
    await fetchPipelines(pagination.page + 1, true);
  }, [pagination, isLoadingMore, fetchPipelines]);

  // Refetch from first page
  const refetch = useCallback(async () => {
    await fetchPipelines(0, false);
  }, [fetchPipelines]);

  // Fetch on mount if enabled
  useEffect(() => {
    if (enabled) {
      fetchPipelines(0, false);
    }
  }, [enabled, fetchPipelines]);

  // Group pipelines by category
  const groupedPipelines = useMemo<GroupedPipelines>(() => {
    const systemDefaults: Pipeline[] = [];
    const myPipelines: Pipeline[] = [];
    const publicPipelines: Pipeline[] = [];

    for (const pipeline of pipelines) {
      if (pipeline.isSystemDefault) {
        systemDefaults.push(pipeline);
      } else if (pipeline.isOwner) {
        myPipelines.push(pipeline);
      } else {
        publicPipelines.push(pipeline);
      }
    }

    return { systemDefaults, myPipelines, publicPipelines };
  }, [pipelines]);

  // Get pipeline by ID
  const getPipelineById = useCallback(
    (id: string) => pipelines.find((p) => p.id === id),
    [pipelines],
  );

  return {
    pipelines,
    groupedPipelines,
    isLoading,
    isLoadingMore,
    error,
    pagination,
    hasMore: pagination?.hasMore ?? false,
    loadMore,
    refetch,
    getPipelineById,
  };
}

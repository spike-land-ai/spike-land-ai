import { useInfiniteQuery } from "@tanstack/react-query";
import { callTool, parseToolResult } from "@/api/client";

export interface LibraryImage {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  tags: string[];
  createdAt: string;
}

interface ImgListResponse {
  count: number;
  offset?: number;
  images: LibraryImage[];
}

export function useLibrary(searchQuery?: string) {
  const limit = 20;

  return useInfiniteQuery({
    queryKey: ["library", searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await callTool("img_list", {
        query: searchQuery,
        limit,
        offset: pageParam,
      });
      const parsed = parseToolResult<ImgListResponse>(result);
      return parsed.images;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < limit) return undefined;
      return allPages.length * limit;
    },
    initialPageParam: 0,
  });
}

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../core-logic/api";
import type { McpAppSummary } from "./useApps";

/** Raw shape returned by the installs endpoint. */
interface InstallRecord {
  app_slug: string;
  installed_at: string;
}

interface InstalledAppsResponse {
  installs?: InstallRecord[];
}

/**
 * Fetches the authenticated user's installed apps from the store API.
 * The query is disabled when no session cookie is present (best-effort check
 * via a 401 response). Falls back to an empty array on any error so the drawer
 * still renders gracefully for unauthenticated visitors.
 */
export function useInstalledApps() {
  return useQuery<McpAppSummary[]>({
    queryKey: ["installed-apps"],
    queryFn: async (): Promise<McpAppSummary[]> => {
      const response = await apiFetch("/store/installs");

      // Unauthenticated — return empty list without throwing so the drawer
      // can render a "Browse apps" CTA instead of an error state.
      if (response.status === 401 || response.status === 403) {
        return [];
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch installs: ${response.status}`);
      }

      const data = (await response.json()) as InstalledAppsResponse;
      const installs = data.installs ?? [];

      return installs.map(
        (record): McpAppSummary => ({
          slug: record.app_slug,
          name: record.app_slug
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          description: "",
          emoji: "📦",
          category: "General Utility",
          tags: [],
          tagline: "",
          pricing: "free",
          is_featured: false,
          is_new: false,
          tool_count: 0,
          sort_order: 0,
        }),
      );
    },
    // Stale after 2 minutes; installs don't change often.
    staleTime: 2 * 60 * 1000,
  });
}

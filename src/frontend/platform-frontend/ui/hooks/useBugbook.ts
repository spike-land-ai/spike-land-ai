import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API = "/api/bugbook";

export interface Bug {
  id: string;
  title: string;
  description?: string;
  category: string;
  status: "CANDIDATE" | "ACTIVE" | "FIXED" | "DEPRECATED";
  severity: "low" | "medium" | "high" | "critical";
  elo: number;
  report_count: number;
  first_seen_at: number;
  last_seen_at: number;
  fixed_at?: number;
  metadata?: string;
}

export interface BugReport {
  id: string;
  bug_id: string;
  reporter_id: string;
  service_name: string;
  description: string;
  severity: string;
  created_at: number;
}

export interface UserEloEntry {
  user_id: string;
  elo: number;
  tier: "free" | "pro" | "business";
  event_count: number;
}

export interface BugbookFilters {
  status?: string;
  category?: string;
  sort?: "elo" | "recent";
  limit?: number;
  offset?: number;
}

export function useBugbookList(filters?: BugbookFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.sort) params.set("sort", filters.sort);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));

  return useQuery({
    queryKey: ["bugbook", "list", filters],
    queryFn: async (): Promise<{ bugs: Bug[]; total: number }> => {
      const res = await fetch(`${API}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch bugs");
      return res.json();
    },
  });
}

export function useBugbookDetail(bugId: string) {
  return useQuery({
    queryKey: ["bugbook", "detail", bugId],
    queryFn: async (): Promise<{
      bug: Bug;
      reports: BugReport[];
      eloHistory: Array<{
        old_elo: number;
        new_elo: number;
        change_amount: number;
        reason: string;
        created_at: number;
      }>;
    }> => {
      const res = await fetch(`${API}/${bugId}`);
      if (!res.ok) throw new Error("Failed to fetch bug");
      return res.json();
    },
    enabled: !!bugId,
  });
}

export function useBugbookLeaderboard() {
  return useQuery({
    queryKey: ["bugbook", "leaderboard"],
    queryFn: async (): Promise<{
      topBugs: Bug[];
      topReporters: UserEloEntry[];
    }> => {
      const res = await fetch(`${API}/leaderboard`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });
}

export function useMyBugReports() {
  return useQuery({
    queryKey: ["bugbook", "my-reports"],
    queryFn: async (): Promise<{
      reports: Array<{
        id: string;
        bug_id: string;
        description: string;
        severity: string;
        created_at: number;
        bug_title: string;
        bug_status: string;
        bug_elo: number;
      }>;
      userElo: { elo: number; tier: string };
    }> => {
      const res = await fetch(`${API}/my-reports`);
      if (!res.ok) throw new Error("Failed to fetch my reports");
      return res.json();
    },
  });
}

export function useReportBug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (report: {
      title: string;
      description: string;
      service_name: string;
      severity: string;
      reproduction_steps?: string;
      error_code?: string;
    }) => {
      const res = await fetch(`${API}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to report bug");
      }
      return res.json() as Promise<{
        bugId: string;
        isNewBug: boolean;
        userElo: { newElo: number; delta: number; tier: string };
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bugbook"] });
    },
  });
}

export function useConfirmBug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bugId: string) => {
      const res = await fetch(`${API}/${bugId}/confirm`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to confirm bug");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bugbook"] });
    },
  });
}

export function useBlogComments(slug: string) {
  return useQuery({
    queryKey: ["blog-comments", slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/${slug}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json() as Promise<Array<{
        id: string;
        user_id: string;
        user_name: string;
        content: string;
        anchor_text?: string;
        position_selector?: string;
        parent_id?: string;
        upvotes: number;
        downvotes: number;
        score: number;
        created_at: number;
      }>>;
    },
    enabled: !!slug,
  });
}

export function usePostComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      slug: string;
      content: string;
      user_name: string;
      anchor_text?: string;
      position_selector?: string;
      parent_id?: string;
    }) => {
      const res = await fetch(`/api/blog/${data.slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["blog-comments", variables.slug] });
    },
  });
}

export function useVoteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { commentId: string; vote: 1 | -1 }) => {
      const res = await fetch(`/api/blog/comments/${data.commentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: data.vote }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to vote");
      }
      return res.json() as Promise<{ score: number; eloPenaltyApplied: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-comments"] });
    },
  });
}

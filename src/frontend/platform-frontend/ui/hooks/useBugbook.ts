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

export interface EloHistoryEntry {
  old_elo: number;
  new_elo: number;
  change_amount: number;
  reason: string;
  created_at: number;
}

export interface BugListResponse {
  bugs: Bug[];
  total: number;
}

export interface BugDetailResponse {
  bug: Bug;
  reports: BugReport[];
  eloHistory: EloHistoryEntry[];
}

export interface LeaderboardResponse {
  topBugs: Bug[];
  topReporters: UserEloEntry[];
}

export interface MyReportEntry {
  id: string;
  bug_id: string;
  description: string;
  severity: string;
  created_at: number;
  bug_title: string;
  bug_status: string;
  bug_elo: number;
}

export interface MyReportsResponse {
  reports: MyReportEntry[];
  userElo: { elo: number; tier: string };
}

export interface ReportBugInput {
  title: string;
  description: string;
  service_name: string;
  severity: string;
  reproduction_steps?: string;
  error_code?: string;
}

export interface ReportBugResponse {
  bugId: string;
  isNewBug: boolean;
  userElo: { newElo: number; delta: number; tier: string };
}

export interface ConfirmBugResponse {
  ok: boolean;
}

export interface BlogComment {
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
}

export interface PostCommentInput {
  slug: string;
  content: string;
  user_name: string;
  anchor_text?: string;
  position_selector?: string;
  parent_id?: string;
}

export interface PostCommentResponse {
  id: string;
  created_at: number;
}

export interface VoteCommentInput {
  commentId: string;
  vote: 1 | -1;
}

export interface VoteCommentResponse {
  score: number;
  eloPenaltyApplied: boolean;
}

/** Extracts the error message from an API error response body, if present. */
async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? fallback;
}

/**
 * Fetches a paginated, optionally filtered list of bugs from the Bugbook API.
 *
 * @param filters - Optional filter and pagination parameters.
 * @returns A TanStack Query result with `data: { bugs, total }`.
 */
export function useBugbookList(filters?: BugbookFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.sort) params.set("sort", filters.sort);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));

  return useQuery({
    queryKey: ["bugbook", "list", filters],
    queryFn: async (): Promise<BugListResponse> => {
      const res = await fetch(`${API}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch bugs");
      return res.json() as Promise<BugListResponse>;
    },
  });
}

/**
 * Fetches the full detail record for a single bug including its reports and
 * ELO rating history.
 *
 * @param bugId - The unique identifier of the bug to fetch.
 * @returns A TanStack Query result with `data: { bug, reports, eloHistory }`.
 *   The query is disabled when `bugId` is empty.
 */
export function useBugbookDetail(bugId: string) {
  return useQuery({
    queryKey: ["bugbook", "detail", bugId],
    queryFn: async (): Promise<BugDetailResponse> => {
      const res = await fetch(`${API}/${bugId}`);
      if (!res.ok) throw new Error("Failed to fetch bug");
      return res.json() as Promise<BugDetailResponse>;
    },
    enabled: !!bugId,
  });
}

/**
 * Fetches the Bugbook leaderboard showing top-ranked bugs and top reporters.
 *
 * @returns A TanStack Query result with `data: { topBugs, topReporters }`.
 */
export function useBugbookLeaderboard() {
  return useQuery({
    queryKey: ["bugbook", "leaderboard"],
    queryFn: async (): Promise<LeaderboardResponse> => {
      const res = await fetch(`${API}/leaderboard`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json() as Promise<LeaderboardResponse>;
    },
  });
}

/**
 * Fetches the authenticated user's bug reports together with their current
 * ELO score.
 *
 * @returns A TanStack Query result with `data: { reports, userElo }`.
 */
export function useMyBugReports() {
  return useQuery({
    queryKey: ["bugbook", "my-reports"],
    queryFn: async (): Promise<MyReportsResponse> => {
      const res = await fetch(`${API}/my-reports`);
      if (!res.ok) throw new Error("Failed to fetch my reports");
      return res.json() as Promise<MyReportsResponse>;
    },
  });
}

/**
 * Submits a new bug report. On success, all `"bugbook"` queries are
 * invalidated so the list and leaderboard refresh automatically.
 *
 * @returns A TanStack Mutation with `mutate(report)` accepting a
 *   {@link ReportBugInput} payload and resolving to a {@link ReportBugResponse}.
 */
export function useReportBug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (report: ReportBugInput): Promise<ReportBugResponse> => {
      const res = await fetch(`${API}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) {
        const message = await extractErrorMessage(res, "Failed to report bug");
        throw new Error(message);
      }
      return res.json() as Promise<ReportBugResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bugbook"] });
    },
  });
}

/**
 * Confirms an existing bug, increasing its ELO score and triggering a cache
 * refresh for all Bugbook queries.
 *
 * @returns A TanStack Mutation with `mutate(bugId)`.
 */
export function useConfirmBug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (bugId: string): Promise<ConfirmBugResponse> => {
      const res = await fetch(`${API}/${bugId}/confirm`, { method: "POST" });
      if (!res.ok) {
        const message = await extractErrorMessage(res, "Failed to confirm bug");
        throw new Error(message);
      }
      return res.json() as Promise<ConfirmBugResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bugbook"] });
    },
  });
}

/**
 * Fetches inline comments for a blog post identified by its slug.
 *
 * @param slug - The blog post slug.
 * @returns A TanStack Query result with `data: BlogComment[]`. Disabled when
 *   `slug` is empty.
 */
export function useBlogComments(slug: string) {
  return useQuery({
    queryKey: ["blog-comments", slug],
    queryFn: async (): Promise<BlogComment[]> => {
      const res = await fetch(`/blog/${slug}/comments`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json() as Promise<BlogComment[]>;
    },
    enabled: !!slug,
  });
}

/**
 * Posts a new comment to a blog post. On success, comments for the target
 * slug are re-fetched automatically.
 *
 * @returns A TanStack Mutation with `mutate(data)` accepting a
 *   {@link PostCommentInput} payload and resolving to a
 *   {@link PostCommentResponse}.
 */
export function usePostComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PostCommentInput): Promise<PostCommentResponse> => {
      const res = await fetch(`/blog/${data.slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json() as Promise<PostCommentResponse>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["blog-comments", variables.slug] });
    },
  });
}

/**
 * Casts a vote on a blog comment. On success, all blog comment caches are
 * invalidated.
 *
 * @returns A TanStack Mutation with `mutate({ commentId, vote })` resolving to
 *   a {@link VoteCommentResponse}.
 */
export function useVoteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: VoteCommentInput): Promise<VoteCommentResponse> => {
      const res = await fetch(`/blog/comments/${data.commentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: data.vote }),
      });
      if (!res.ok) {
        const message = await extractErrorMessage(res, "Failed to vote");
        throw new Error(message);
      }
      return res.json() as Promise<VoteCommentResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-comments"] });
    },
  });
}

import { describe, expect, it, vi } from "vitest";

// Mock store-apps module
vi.mock("@/app/store/data/store-apps", () => ({
  STORE_APPS: [
    {
      slug: "chess-arena",
      mcpTools: [
        { name: "chess_create_game", category: "chess-game", description: "Create game" },
        { name: "chess_make_move", category: "chess-game", description: "Make move" },
        { name: "chess_create_player", category: "chess-player", description: "Create player" },
        {
          name: "chess_send_challenge",
          category: "chess-challenge",
          description: "Send challenge",
        },
        { name: "chess_replay_game", category: "chess-replay", description: "Replay game" },
        {
          name: "chess_create_tournament",
          category: "chess-tournament",
          description: "Create tournament",
        },
        { name: "chess_get_puzzle", category: "chess-tournament", description: "Get puzzle" },
      ],
    },
    {
      slug: "cleansweep",
      mcpTools: [
        { name: "upload_photo", category: "clean-photo", description: "Upload photo" },
        { name: "create_task", category: "clean-tasks", description: "Create task" },
        { name: "clean_create_room", category: "clean-rooms", description: "Create room" },
        { name: "clean_get_statistics", category: "clean-rooms", description: "Get statistics" },
      ],
    },
    {
      slug: "audio-studio",
      mcpTools: [
        { name: "audio_create_project", category: "audio", description: "Create project" },
        { name: "audio_apply_effect", category: "audio-effects", description: "Apply effect" },
        { name: "audio_export_mix", category: "audio-effects", description: "Export mix" },
      ],
    },
    {
      slug: "content-hub",
      mcpTools: [
        { name: "blog_list_posts", category: "blog", description: "List posts" },
        { name: "blog_create_draft", category: "blog-management", description: "Create draft" },
      ],
    },
    {
      slug: "social-autopilot",
      mcpTools: [
        { name: "calendar_schedule_post", category: "calendar", description: "Schedule post" },
        {
          name: "calendar_get_analytics",
          category: "calendar-analytics",
          description: "Get analytics",
        },
      ],
    },
    {
      slug: "be-uniq",
      mcpTools: [
        { name: "profile_start", category: "avl-profile", description: "Start profile" },
        { name: "profile_get_leaderboard", category: "avl-social", description: "Get leaderboard" },
      ],
    },
    {
      slug: "brand-command",
      mcpTools: [
        { name: "brand_score_content", category: "brand-brain", description: "Score content" },
        {
          name: "brand_create_campaign",
          category: "brand-campaigns",
          description: "Create campaign",
        },
      ],
    },
    {
      slug: "career-navigator",
      mcpTools: [
        { name: "career_assess_skills", category: "career", description: "Assess skills" },
        { name: "career_create_resume", category: "career-growth", description: "Create resume" },
        {
          name: "calendar_get_analytics",
          category: "calendar-analytics",
          description: "Get analytics",
        },
      ],
    },
    {
      slug: "tabletop-sim",
      mcpTools: [
        { name: "create_room", category: "tabletop", description: "Create room" },
        { name: "tabletop_save_game", category: "tabletop-state", description: "Save game" },
      ],
    },
    {
      slug: "codespace",
      mcpTools: [
        { name: "fs_read", category: "filesystem", description: "Read file" },
        {
          name: "codespace_list_templates",
          category: "codespace-templates",
          description: "List templates",
        },
      ],
    },
    {
      slug: "qa-studio",
      mcpTools: [
        { name: "qa_navigate", category: "qa-studio", description: "Navigate" },
        { name: "qa_lighthouse", category: "qa-performance", description: "Lighthouse audit" },
      ],
    },
    {
      slug: "state-machine",
      mcpTools: [
        { name: "sm_create", category: "state-machine", description: "Create machine" },
        { name: "sm_list_templates", category: "sm-templates", description: "List templates" },
      ],
    },
    {
      slug: "mcp-explorer",
      mcpTools: [
        { name: "search_tools", category: "gateway-meta", description: "Search tools" },
        { name: "mcp_tool_usage_stats", category: "mcp-analytics", description: "Usage stats" },
      ],
    },
    {
      slug: "ai-orchestrator",
      mcpTools: [
        { name: "swarm_spawn_agent", category: "swarm", description: "Spawn agent" },
        { name: "swarm_get_metrics", category: "swarm-monitoring", description: "Get metrics" },
      ],
    },
    {
      slug: "code-review-agent",
      mcpTools: [
        { name: "review_code", category: "review", description: "Review code" },
        { name: "review_get_diff", category: "review-pr", description: "Get diff" },
      ],
    },
    {
      slug: "page-builder",
      mcpTools: [
        { name: "pages_create", category: "pages", description: "Create page" },
        { name: "pages_list_templates", category: "page-templates", description: "List templates" },
      ],
    },
    {
      slug: "empty-app",
      mcpTools: [],
    },
  ],
  getAppBySlug: (slug: string) => {
    const apps = [
      {
        slug: "chess-arena",
        mcpTools: [
          { name: "chess_create_game", category: "chess-game", description: "Create game" },
          { name: "chess_make_move", category: "chess-game", description: "Make move" },
          { name: "chess_create_player", category: "chess-player", description: "Create player" },
          {
            name: "chess_send_challenge",
            category: "chess-challenge",
            description: "Send challenge",
          },
          { name: "chess_replay_game", category: "chess-replay", description: "Replay game" },
          {
            name: "chess_create_tournament",
            category: "chess-tournament",
            description: "Create tournament",
          },
          { name: "chess_get_puzzle", category: "chess-tournament", description: "Get puzzle" },
        ],
      },
      {
        slug: "cleansweep",
        mcpTools: [
          { name: "upload_photo", category: "clean-photo", description: "Upload photo" },
          { name: "create_task", category: "clean-tasks", description: "Create task" },
          { name: "clean_create_room", category: "clean-rooms", description: "Create room" },
          { name: "clean_get_statistics", category: "clean-rooms", description: "Get statistics" },
        ],
      },
      {
        slug: "audio-studio",
        mcpTools: [
          { name: "audio_create_project", category: "audio", description: "Create project" },
          { name: "audio_apply_effect", category: "audio-effects", description: "Apply effect" },
          { name: "audio_export_mix", category: "audio-effects", description: "Export mix" },
        ],
      },
      {
        slug: "content-hub",
        mcpTools: [
          { name: "blog_list_posts", category: "blog", description: "List posts" },
          { name: "blog_create_draft", category: "blog-management", description: "Create draft" },
        ],
      },
      {
        slug: "social-autopilot",
        mcpTools: [
          { name: "calendar_schedule_post", category: "calendar", description: "Schedule post" },
          {
            name: "calendar_get_analytics",
            category: "calendar-analytics",
            description: "Get analytics",
          },
        ],
      },
      {
        slug: "be-uniq",
        mcpTools: [
          { name: "profile_start", category: "avl-profile", description: "Start profile" },
          {
            name: "profile_get_leaderboard",
            category: "avl-social",
            description: "Get leaderboard",
          },
        ],
      },
      {
        slug: "brand-command",
        mcpTools: [
          { name: "brand_score_content", category: "brand-brain", description: "Score content" },
          {
            name: "brand_create_campaign",
            category: "brand-campaigns",
            description: "Create campaign",
          },
        ],
      },
      {
        slug: "career-navigator",
        mcpTools: [
          { name: "career_assess_skills", category: "career", description: "Assess skills" },
          { name: "career_create_resume", category: "career-growth", description: "Create resume" },
          {
            name: "calendar_get_analytics",
            category: "calendar-analytics",
            description: "Get analytics",
          },
        ],
      },
      {
        slug: "tabletop-sim",
        mcpTools: [
          { name: "create_room", category: "tabletop", description: "Create room" },
          { name: "tabletop_save_game", category: "tabletop-state", description: "Save game" },
        ],
      },
      {
        slug: "codespace",
        mcpTools: [
          { name: "fs_read", category: "filesystem", description: "Read file" },
          {
            name: "codespace_list_templates",
            category: "codespace-templates",
            description: "List templates",
          },
        ],
      },
      {
        slug: "qa-studio",
        mcpTools: [
          { name: "qa_navigate", category: "qa-studio", description: "Navigate" },
          { name: "qa_lighthouse", category: "qa-performance", description: "Lighthouse audit" },
        ],
      },
      {
        slug: "state-machine",
        mcpTools: [
          { name: "sm_create", category: "state-machine", description: "Create machine" },
          { name: "sm_list_templates", category: "sm-templates", description: "List templates" },
        ],
      },
      {
        slug: "mcp-explorer",
        mcpTools: [
          { name: "search_tools", category: "gateway-meta", description: "Search tools" },
          { name: "mcp_tool_usage_stats", category: "mcp-analytics", description: "Usage stats" },
        ],
      },
      {
        slug: "ai-orchestrator",
        mcpTools: [
          { name: "swarm_spawn_agent", category: "swarm", description: "Spawn agent" },
          { name: "swarm_get_metrics", category: "swarm-monitoring", description: "Get metrics" },
        ],
      },
      {
        slug: "code-review-agent",
        mcpTools: [
          { name: "review_code", category: "review", description: "Review code" },
          { name: "review_get_diff", category: "review-pr", description: "Get diff" },
        ],
      },
      {
        slug: "page-builder",
        mcpTools: [
          { name: "pages_create", category: "pages", description: "Create page" },
          {
            name: "pages_list_templates",
            category: "page-templates",
            description: "List templates",
          },
        ],
      },
      {
        slug: "empty-app",
        mcpTools: [],
      },
    ];
    return apps.find(a => a.slug === slug);
  },
}));

// Mock tool-manifest with categories
vi.mock("./tool-manifest", () => ({
  TOOL_MODULES: [
    { register: vi.fn(), categories: ["gateway-meta"] },
    { register: vi.fn(), categories: ["chess-game"] },
    { register: vi.fn(), categories: ["chess-player"] },
    { register: vi.fn(), categories: ["chess-challenge"] },
    { register: vi.fn(), categories: ["chess-replay"] },
    { register: vi.fn(), categories: ["clean-photo"] },
    { register: vi.fn(), categories: ["clean-tasks"] },
    { register: vi.fn(), categories: ["storage"] },
    { register: vi.fn() }, // no categories (platform module)
  ],
}));

import { getAllAppCategories, getToolModulesForApp } from "./app-tool-resolver";

describe("getToolModulesForApp", () => {
  it("returns chess modules for chess-arena", () => {
    const modules = getToolModulesForApp("chess-arena");
    const categories = modules.flatMap(m => m.categories ?? []);
    expect(categories).toContain("chess-game");
    expect(categories).toContain("chess-player");
    expect(categories).toContain("chess-challenge");
    expect(categories).toContain("chess-replay");
    expect(categories).not.toContain("gateway-meta");
    expect(categories).not.toContain("storage");
  });

  it("returns clean modules for cleansweep", () => {
    const modules = getToolModulesForApp("cleansweep");
    const categories = modules.flatMap(m => m.categories ?? []);
    expect(categories).toContain("clean-photo");
    expect(categories).toContain("clean-tasks");
    expect(categories).not.toContain("chess-game");
  });

  it("returns empty array for unknown app", () => {
    const modules = getToolModulesForApp("nonexistent");
    expect(modules).toEqual([]);
  });

  it("returns empty array for app with no tools", () => {
    const modules = getToolModulesForApp("empty-app");
    expect(modules).toEqual([]);
  });

  it("does not include modules without categories", () => {
    const modules = getToolModulesForApp("chess-arena");
    expect(modules.every(m => m.categories && m.categories.length > 0)).toBe(
      true,
    );
  });
});

describe("getAllAppCategories", () => {
  it("returns categories for all apps with tools", () => {
    const map = getAllAppCategories();
    expect(map.has("chess-arena")).toBe(true);
    expect(map.has("cleansweep")).toBe(true);
    expect(map.has("empty-app")).toBe(false);
  });

  it("chess-arena has 5 unique categories", () => {
    const map = getAllAppCategories();
    const chessCategories = map.get("chess-arena")!;
    expect(chessCategories).toHaveLength(5);
    expect(chessCategories).toContain("chess-game");
    expect(chessCategories).toContain("chess-player");
    expect(chessCategories).toContain("chess-challenge");
    expect(chessCategories).toContain("chess-replay");
    expect(chessCategories).toContain("chess-tournament");
  });
});

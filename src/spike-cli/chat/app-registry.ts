/**
 * App Registry for mapping MCP tools to spike.land store apps.
 * Provides O(1) tool→app lookup and app-based tool grouping.
 */

import type { ServerManager } from "../multiplexer/server-manager";
import { executeToolCall } from "./tool-adapter";

/** Minimal app info needed for CLI tool grouping. */
export interface AppInfo {
  slug: string;
  name: string;
  icon: string;
  category: string;
  tagline: string;
  toolNames: string[];
}

/** Registry interface for looking up apps by tool name. */
export interface AppRegistry {
  getAppForTool(toolName: string): AppInfo | undefined;
  getAllApps(): AppInfo[];
  getApp(slug: string): AppInfo | undefined;
}

/**
 * Bundled app registry data extracted from store app definitions.
 * This is a static snapshot; refreshFromRemote() updates it at runtime.
 */
const BUNDLED_APP_REGISTRY: AppInfo[] = [
  {
    slug: "audio-studio",
    name: "Audio Studio",
    icon: "Music",
    category: "creative",
    tagline: "Multi-track audio mixing studio",
    toolNames: [
      "audio_create_project",
      "audio_list_projects",
      "audio_upload",
      "audio_list_tracks",
      "audio_get_track",
      "audio_update_track",
    ],
  },
  {
    slug: "page-builder",
    name: "Page Builder",
    icon: "Layout",
    category: "creative",
    tagline: "Visual web page builder",
    toolNames: [
      "pages_create",
      "pages_get",
      "pages_list",
      "pages_update",
      "pages_delete",
      "pages_publish",
      "pages_clone",
    ],
  },
  {
    slug: "brand-command",
    name: "Brand Command",
    icon: "Megaphone",
    category: "creative",
    tagline: "Brand voice control center",
    toolNames: [
      "brand_score_content",
      "brand_get_guardrails",
      "brand_check_policy",
      "relay_generate_drafts",
      "scout_list_competitors",
      "scout_get_insights",
    ],
  },
  {
    slug: "content-hub",
    name: "Content Hub",
    icon: "FileText",
    category: "productivity",
    tagline: "Blog publishing platform",
    toolNames: ["blog_list_posts", "blog_get_post"],
  },
  {
    slug: "social-autopilot",
    name: "Social Autopilot",
    icon: "Calendar",
    category: "productivity",
    tagline: "Social media scheduler",
    toolNames: [
      "calendar_schedule_post",
      "calendar_list_scheduled",
      "calendar_cancel_post",
      "calendar_get_best_times",
      "calendar_detect_gaps",
    ],
  },
  {
    slug: "codespace",
    name: "CodeSpace",
    icon: "Code",
    category: "developer",
    tagline: "Live React code editor",
    toolNames: [
      "read_file",
      "write_file",
      "edit_file",
      "glob_files",
      "grep_files",
      "create_app",
      "search_apps",
      "classify_idea",
    ],
  },
  {
    slug: "qa-studio",
    name: "QA Studio",
    icon: "Microscope",
    category: "developer",
    tagline: "Automated QA toolkit",
    toolNames: [
      "browser_navigate",
      "browser_screenshot",
      "browser_click",
      "browser_type",
      "browser_session_status",
      "accessibility_audit",
      "accessibility_audit_status",
      "run_tests",
      "analyze_coverage",
      "list_tests",
    ],
  },
  {
    slug: "state-machine",
    name: "State Machine Studio",
    icon: "Workflow",
    category: "developer",
    tagline: "Visual statechart builder",
    toolNames: [
      "sm_create",
      "sm_add_state",
      "sm_remove_state",
      "sm_add_transition",
      "sm_remove_transition",
      "sm_set_context",
      "sm_send_event",
      "sm_get_state",
      "sm_get_history",
      "sm_reset",
      "sm_validate",
      "sm_export",
      "sm_visualize",
      "sm_list",
    ],
  },
  {
    slug: "mcp-explorer",
    name: "MCP Explorer",
    icon: "Terminal",
    category: "developer",
    tagline: "MCP app playground",
    toolNames: [
      "mcp_list_tools",
      "mcp_call_tool",
      "mcp_list_categories",
      "mcp_search_tools",
      "mcp_get_tool_schema",
      "mcp_list_resources",
      "mcp_read_resource",
      "mcp_server_info",
    ],
  },
  {
    slug: "tabletop-sim",
    name: "Tabletop Sim",
    icon: "Gamepad2",
    category: "communication",
    tagline: "Virtual tabletop for games",
    toolNames: ["create_room", "join_room", "roll_dice", "move_piece"],
  },
  {
    slug: "chess-arena",
    name: "Chess Arena",
    icon: "Crown",
    category: "communication",
    tagline: "Multiplayer chess with ELO",
    toolNames: [
      "chess_create_game",
      "chess_join_game",
      "chess_make_move",
      "chess_get_game",
      "chess_list_games",
      "chess_resign",
      "chess_offer_draw",
      "chess_accept_draw",
      "chess_create_player",
      "chess_get_player",
      "chess_list_profiles",
      "chess_update_player",
      "chess_get_stats",
      "chess_list_online",
      "chess_send_challenge",
      "chess_accept_challenge",
      "chess_decline_challenge",
      "chess_cancel_challenge",
      "chess_list_challenges",
      "chess_replay_game",
      "chess_get_leaderboard",
    ],
  },
  {
    slug: "cleansweep",
    name: "CleanSweep",
    icon: "Heart",
    category: "lifestyle",
    tagline: "Gamified room cleaning",
    toolNames: [
      "upload_photo",
      "get_photo_analysis",
      "scan_room",
      "get_scan_results",
      "create_task",
      "list_tasks",
      "complete_task",
      "skip_task",
      "get_streak",
      "update_streak",
      "set_reminder",
      "list_reminders",
      "verify_clean",
      "get_motivation",
    ],
  },
  {
    slug: "career-navigator",
    name: "Career Navigator",
    icon: "Briefcase",
    category: "lifestyle",
    tagline: "Career intelligence tool",
    toolNames: [
      "assess_skills",
      "search_occupations",
      "salary_data",
      "job_listings",
    ],
  },
  {
    slug: "be-uniq",
    name: "beUniq",
    icon: "Fingerprint",
    category: "lifestyle",
    tagline: "Personality uniqueness game",
    toolNames: [
      "profile_start",
      "profile_answer",
      "profile_get",
      "profile_tree_stats",
      "profile_generate_question",
      "profile_reset",
    ],
  },
  {
    slug: "boycott-vmo2",
    name: "Boycott VMO2",
    icon: "Wifi",
    category: "lifestyle",
    tagline: "Find better TV & broadband",
    toolNames: ["compare_providers"],
  },
  {
    slug: "ai-orchestrator",
    name: "AI Orchestrator",
    icon: "Bot",
    category: "ai-agents",
    tagline: "Multi-agent AI coordinator",
    toolNames: [
      "swarm_spawn_agent",
      "swarm_list_agents",
      "swarm_get_agent",
      "swarm_stop_agent",
      "swarm_redirect_agent",
      "swarm_broadcast",
      "swarm_agent_timeline",
      "swarm_topology",
      "swarm_send_message",
      "swarm_read_messages",
      "swarm_delegate_task",
    ],
  },
  {
    slug: "code-review-agent",
    name: "Code Review Agent",
    icon: "GitPullRequest",
    category: "ai-agents",
    tagline: "AI code review service",
    toolNames: [
      "review_code",
      "review_analyze_complexity",
      "review_get_report",
      "review_project_rules",
      "review_estimate_effort",
    ],
  },
];

export class AppRegistryImpl implements AppRegistry {
  private apps: AppInfo[];
  private toolToApp: Map<string, AppInfo>;
  private slugToApp: Map<string, AppInfo>;

  constructor(apps?: AppInfo[]) {
    this.apps = apps ?? [...BUNDLED_APP_REGISTRY];
    this.toolToApp = new Map();
    this.slugToApp = new Map();
    this.rebuildIndex();
  }

  private rebuildIndex(): void {
    this.toolToApp.clear();
    this.slugToApp.clear();
    for (const app of this.apps) {
      this.slugToApp.set(app.slug, app);
      for (const toolName of app.toolNames) {
        this.toolToApp.set(toolName, app);
      }
    }
  }

  getAppForTool(toolName: string): AppInfo | undefined {
    return this.toolToApp.get(toolName);
  }

  getAllApps(): AppInfo[] {
    return this.apps;
  }

  getApp(slug: string): AppInfo | undefined {
    return this.slugToApp.get(slug);
  }

  /**
   * Attempt to refresh the registry from a remote MCP server.
   * Falls back to bundled data silently on failure.
   */
  async refreshFromRemote(manager: ServerManager): Promise<void> {
    try {
      // Look for the store_list_apps_with_tools tool
      const allTools = manager.getAllTools();
      const storeTool = allTools.find(t =>
        t.originalName === "store_list_apps_with_tools"
        || t.namespacedName.endsWith("store_list_apps_with_tools")
      );

      if (!storeTool) return;

      const { result, isError } = await executeToolCall(
        manager,
        storeTool.namespacedName,
        {},
      );

      if (isError) return;

      const parsed: AppInfo[] = JSON.parse(result);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.apps = parsed;
        this.rebuildIndex();
      }
    } catch {
      // Silently fall back to bundled data
    }
  }
}

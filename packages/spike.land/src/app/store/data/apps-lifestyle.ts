import { getAppMcpUrl, type StoreApp } from "./types";

export const LIFESTYLE_APPS: StoreApp[] = [
  // ─── 11. CleanSweep ───────────────────────────────────────────────
  {
    id: "cleansweep",
    slug: "cleansweep",
    name: "CleanSweep",
    tagline: "Gamified room cleaning",
    description: "Scan rooms with AI, get bite-sized tasks, and earn streaks for cleaning.",
    longDescription:
      "Designed for people with ADHD. Snap a photo, get prioritized micro-tasks, complete them to build streaks, and verify results with an after photo. The motivation engine celebrates progress to maintain momentum.",
    category: "lifestyle",
    cardVariant: "orange",
    icon: "Heart",
    appUrl: "/clean",
    mcpServerUrl: getAppMcpUrl("cleansweep"),
    isFeatured: true,
    isFirstParty: true,
    toolCount: 19,
    tags: ["cleaning", "adhd", "gamification", "ai-scanning"],
    color: "orange",
    mcpTools: [
      {
        name: "upload_photo",
        category: "clean-photo",
        description: "Upload a room photo for AI analysis and task generation",
      },
      {
        name: "get_photo_analysis",
        category: "clean-photo",
        description: "Retrieve the AI analysis results for an uploaded room photo",
      },
      {
        name: "scan_room",
        category: "clean-scanner",
        description: "Run the AI scanner on a room photo to identify mess zones and priorities",
      },
      {
        name: "get_scan_results",
        category: "clean-scanner",
        description: "Get detailed scan results with identified areas and severity scores",
      },
      {
        name: "create_task",
        category: "clean-tasks",
        description: "Create a cleaning task with description, location, and estimated duration",
      },
      {
        name: "list_tasks",
        category: "clean-tasks",
        description: "List all pending cleaning tasks sorted by priority and location",
      },
      {
        name: "complete_task",
        category: "clean-tasks",
        description: "Mark a cleaning task as completed with an optional verification photo",
      },
      {
        name: "skip_task",
        category: "clean-tasks",
        description: "Skip a task and reschedule it for later with a reason",
      },
      {
        name: "get_streak",
        category: "clean-streaks",
        description: "Get the current cleaning streak count and history",
      },
      {
        name: "update_streak",
        category: "clean-streaks",
        description: "Update the streak counter based on daily task completion",
      },
      {
        name: "set_reminder",
        category: "clean-reminders",
        description: "Set a cleaning reminder with time, frequency, and custom message",
      },
      {
        name: "list_reminders",
        category: "clean-reminders",
        description: "List all active cleaning reminders with their schedules",
      },
      {
        name: "verify_clean",
        category: "clean-verify",
        description: "Submit an after photo for AI verification that a task was completed",
      },
      {
        name: "get_motivation",
        category: "clean-motivate",
        description: "Get a personalized motivational message based on progress and streaks",
      },
      {
        name: "clean_create_room",
        category: "clean-rooms",
        description: "Create a named room with a cleaning difficulty level",
      },
      {
        name: "clean_list_rooms",
        category: "clean-rooms",
        description: "List all registered rooms with last-cleaned timestamp",
      },
      {
        name: "clean_get_room_history",
        category: "clean-rooms",
        description: "Get the cleaning session history for a specific room",
      },
      {
        name: "clean_get_statistics",
        category: "clean-rooms",
        description: "Get aggregated cleaning statistics across all rooms",
      },
      {
        name: "clean_set_schedule",
        category: "clean-rooms",
        description: "Set a recurring cleaning schedule for a room",
      },
    ],
    features: [
      {
        title: "Room Scanning",
        description: "AI identifies mess zones and generates cleaning tasks",
        icon: "Camera",
      },
      {
        title: "Gamification",
        description: "Earn points, badges, and rewards for completed tasks",
        icon: "Trophy",
      },
      {
        title: "Streak Tracking",
        description: "Build daily streaks to maintain momentum",
        icon: "Flame",
      },
      {
        title: "AI Verification",
        description: "Verify completion with an after photo for AI comparison",
        icon: "CheckCircle",
      },
    ],
  },

  // ─── 12. Career Navigator ─────────────────────────────────────────
  {
    id: "career-navigator",
    slug: "career-navigator",
    name: "Career Navigator",
    tagline: "Career intelligence tool",
    description: "Assess your skills, explore occupations, and compare salary data.",
    longDescription:
      "For job seekers and career changers. Take a skills assessment, browse ESCO-aligned occupations that match your profile, compare compensation across regions, and find relevant job listings.",
    category: "lifestyle",
    cardVariant: "fuchsia",
    icon: "Briefcase",
    appUrl: "/career",
    mcpServerUrl: getAppMcpUrl("career-navigator"),
    codespaceId: "storeCareerNav",
    isCodespaceNative: true,
    isFeatured: false,
    isFirstParty: true,
    toolCount: 10,
    tags: ["career", "skills", "salary-data", "job-market"],
    color: "fuchsia",
    mcpTools: [
      {
        name: "career_assess_skills",
        category: "career",
        description: "Match user skills against ESCO occupations with scores and gap analysis",
      },
      {
        name: "career_search_occupations",
        category: "career",
        description: "Search occupations by skills, interests, or keywords using ESCO taxonomy",
      },
      {
        name: "career_get_occupation",
        category: "career",
        description: "Get detailed occupation data including required skills and ISCO group",
      },
      {
        name: "career_compare_skills",
        category: "career",
        description: "Compare user skills against a specific occupation with gap analysis",
      },
      {
        name: "career_get_salary",
        category: "career",
        description: "Get salary estimates for an occupation in a specific location",
      },
      {
        name: "career_get_jobs",
        category: "career",
        description: "Search for job listings matching a query and location",
      },
      {
        name: "career_create_resume",
        category: "career-growth",
        description: "Generate a tailored resume for a target role with highlights",
      },
      {
        name: "career_match_jobs",
        category: "career-growth",
        description: "Match your profile against job listings with scored results",
      },
      {
        name: "career_get_learning_path",
        category: "career-growth",
        description: "Get a personalized learning path to close skill gaps",
      },
      {
        name: "career_interview_prep",
        category: "career-growth",
        description: "Generate role-specific interview questions with model answers",
      },
    ],
    features: [
      {
        title: "Skills Radar",
        description: "Visualize your skill profile and growth areas",
        icon: "Target",
      },
      {
        title: "Job Market",
        description: "Explore trending occupations and in-demand skills",
        icon: "TrendingUp",
      },
      {
        title: "Salary Data",
        description: "Compare compensation across regions and industries",
        icon: "DollarSign",
      },
      {
        title: "ESCO Integration",
        description: "ESCO-aligned skills and occupations framework",
        icon: "Globe",
      },
    ],
  },

  // ─── 19. beUniq ──────────────────────────────────────────────────
  {
    id: "be-uniq",
    slug: "be-uniq",
    name: "beUniq",
    tagline: "Personality uniqueness game",
    description: "Answer yes/no questions until your combination is one nobody else has chosen.",
    longDescription:
      "A social game that turns personality profiling into a challenge. Each answer navigates a growing tree of responses. The more players join, the harder uniqueness becomes. Discover your personality tags and compare paths with friends.",
    category: "lifestyle",
    cardVariant: "fuchsia",
    icon: "Fingerprint",
    appUrl: "/apps/be-uniq",
    mcpServerUrl: getAppMcpUrl("be-uniq"),
    isFeatured: true,
    isFirstParty: true,
    toolCount: 11,
    tags: ["game", "personality", "profiling", "uniqueness", "avl-tree"],
    color: "fuchsia",
    mcpTools: [
      {
        name: "profile_start",
        category: "avl-profile",
        description: "Begin profiling — returns the first yes/no question or existing profile",
      },
      {
        name: "profile_continue",
        category: "avl-profile",
        description: "Continue profiling for a returning user with new questions if tree has grown",
      },
      {
        name: "profile_answer",
        category: "avl-profile",
        description: "Answer yes or no to the current question and get the next one",
      },
      {
        name: "profile_get",
        category: "avl-profile",
        description: "Retrieve your profile with answer path, tags, and tree position",
      },
      {
        name: "profile_tree_stats",
        category: "avl-profile",
        description: "Get community statistics: total players, tree depth, node counts",
      },
      {
        name: "profile_generate_question",
        category: "avl-profile",
        description: "Generate a new differentiating question when two players collide",
      },
      {
        name: "profile_reset",
        category: "avl-profile",
        description: "Reset your profile to play again from scratch",
      },
      {
        name: "profile_get_leaderboard",
        category: "avl-social",
        description: "Get the leaderboard of most unique profiles",
      },
      {
        name: "profile_share_result",
        category: "avl-social",
        description: "Generate a shareable card for your uniqueness result",
      },
      {
        name: "profile_compare",
        category: "avl-social",
        description: "Compare your answer path with another player's",
      },
      {
        name: "profile_get_insights",
        category: "avl-social",
        description: "Get personality insights derived from your answer pattern",
      },
    ],
    features: [
      {
        title: "Unique Discovery",
        description: "Find a yes/no answer path nobody else has chosen",
        icon: "Fingerprint",
      },
      {
        title: "Growing Challenge",
        description: "Tree grows deeper as more players join",
        icon: "TrendingUp",
      },
      {
        title: "Personality Tags",
        description: "Discover personality tags from your answer pattern",
        icon: "Tags",
      },
      {
        title: "Community Stats",
        description: "See total players and question tree depth",
        icon: "Users",
      },
    ],
  },
];

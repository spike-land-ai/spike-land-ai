import { getAppMcpUrl, type StoreApp } from "./types";

export const DEVELOPER_APPS: StoreApp[] = [
  // ─── 7. Spike Land Admin ──────────────────────────────────────────
  {
    id: "spike-land-admin",
    slug: "spike-land-admin",
    name: "Spike Land Admin",
    tagline: "Platform admin dashboard",
    description: "Manage users, monitor system health, and control platform operations.",
    longDescription:
      "The central admin hub for spike.land. User management, system health monitoring, analytics, and platform configuration — all in one secure dashboard. Admin-only access.",
    category: "developer",
    cardVariant: "purple",
    icon: "Shield",
    appUrl: "/apps/spike-land-admin",
    isFeatured: false,
    isFirstParty: true,
    isAdminOnly: true,
    toolCount: 0,
    tags: ["admin", "monitoring", "users", "analytics"],
    color: "purple",
    mcpTools: [],
    features: [
      {
        title: "User Management",
        description: "Manage users, roles, and permissions",
        icon: "Users",
      },
      {
        title: "System Health",
        description: "Monitor uptime, health, and performance metrics",
        icon: "Activity",
      },
      {
        title: "Analytics",
        description: "View platform analytics and usage trends",
        icon: "BarChart3",
      },
      {
        title: "Operations",
        description: "Control platform operations and settings",
        icon: "Settings",
      },
    ],
  },

  // ─── 8. CodeSpace ─────────────────────────────────────────────────
  {
    id: "codespace",
    slug: "codespace",
    name: "CodeSpace",
    tagline: "Live React code editor",
    description: "Write, preview, and deploy React components in real time with AI assistance.",
    longDescription:
      "A browser-based editor built for React development. Full TypeScript support, live preview, AI-powered suggestions, and one-click deploy to spike.land. Generate entire apps from a single prompt.",
    category: "developer",
    cardVariant: "blue",
    icon: "Code",
    appUrl: "/create",
    mcpServerUrl: getAppMcpUrl("codespace"),
    isFeatured: true,
    isFirstParty: true,
    toolCount: 12,
    tags: ["code-editor", "react", "ai-assist", "live-preview"],
    color: "blue",
    mcpTools: [
      {
        name: "fs_read",
        category: "filesystem",
        description: "Read a file from the codespace virtual filesystem",
      },
      {
        name: "fs_write",
        category: "filesystem",
        description: "Write or create a file in the codespace virtual filesystem",
      },
      {
        name: "fs_edit",
        category: "filesystem",
        description: "Apply targeted edits to a file using search-and-replace",
      },
      {
        name: "fs_glob",
        category: "filesystem",
        description: "Find files matching a glob pattern across the project",
      },
      {
        name: "fs_grep",
        category: "filesystem",
        description: "Search file contents with regex patterns and return matching lines",
      },
      {
        name: "codespace_update",
        category: "codespace",
        description: "Create or update a live React application with transpilation",
      },
      {
        name: "codespace_get",
        category: "codespace",
        description: "Get the current code and session data for a codespace",
      },
      {
        name: "codespace_screenshot",
        category: "codespace",
        description: "Get a JPEG screenshot of a running codespace",
      },
      {
        name: "codespace_list_templates",
        category: "codespace-templates",
        description: "List available codespace starter templates by framework",
      },
      {
        name: "codespace_create_from_template",
        category: "codespace-templates",
        description: "Create a new codespace from a template with optional customization",
      },
      {
        name: "codespace_get_dependencies",
        category: "codespace-templates",
        description: "Get the npm dependency tree for a codespace",
      },
      {
        name: "codespace_add_dependency",
        category: "codespace-templates",
        description: "Add a new npm dependency to a codespace",
      },
    ],
    features: [
      {
        title: "Live Preview",
        description: "Live component preview as you type",
        icon: "Play",
      },
      {
        title: "AI Code Assist",
        description: "AI-powered suggestions, refactoring, and generation",
        icon: "Sparkles",
      },
      {
        title: "File System",
        description: "Virtual filesystem with glob and grep search",
        icon: "FolderOpen",
      },
      {
        title: "App Generator",
        description: "Generate full React apps from a text prompt",
        icon: "Zap",
      },
    ],
  },

  // ─── 16. QA Studio ──────────────────────────────────────────────
  {
    id: "qa-studio",
    slug: "qa-studio",
    name: "QA Studio",
    tagline: "Automated QA toolkit",
    description:
      "Run browser tests, accessibility audits, and coverage analysis from one dashboard.",
    longDescription:
      "For QA engineers and developers who want automated quality assurance. Playwright-powered browser automation, WCAG accessibility audits, Vitest integration, and line-level coverage reporting — all as composable MCP endpoints.",
    category: "developer",
    cardVariant: "green",
    icon: "Microscope",
    appUrl: "/apps/qa-studio",
    mcpServerUrl: getAppMcpUrl("qa-studio"),
    isFeatured: false,
    isFirstParty: true,
    toolCount: 15,
    tags: ["testing", "qa", "accessibility", "browser-automation"],
    color: "green",
    mcpTools: [
      {
        name: "qa_navigate",
        category: "qa-studio",
        description: "Navigate a browser session to a URL and capture the page state",
      },
      {
        name: "qa_screenshot",
        category: "qa-studio",
        description: "Take a screenshot of the current browser session viewport",
      },
      {
        name: "qa_accessibility",
        category: "qa-studio",
        description: "Run a WCAG accessibility audit on a URL and report violations",
      },
      {
        name: "qa_console",
        category: "qa-studio",
        description: "Get browser console messages from the current session",
      },
      {
        name: "qa_network",
        category: "qa-studio",
        description: "Get network requests from the current browser session",
      },
      {
        name: "qa_viewport",
        category: "qa-studio",
        description: "Resize the browser viewport for responsive testing",
      },
      {
        name: "qa_evaluate",
        category: "qa-studio",
        description: "Evaluate JavaScript in the browser page context",
      },
      {
        name: "qa_tabs",
        category: "qa-studio",
        description: "Manage browser tabs: list, create, close, or switch",
      },
      {
        name: "qa_test_run",
        category: "qa-studio",
        description: "Execute Vitest test suites with structured pass/fail reporting",
      },
      {
        name: "qa_coverage",
        category: "qa-studio",
        description: "Analyze code coverage and identify untested lines and branches",
      },
      {
        name: "qa_mobile_audit",
        category: "qa-studio",
        description: "Run a mobile usability audit on a URL",
      },
      {
        name: "qa_lighthouse",
        category: "qa-performance",
        description: "Run a Lighthouse performance audit and return scored metrics",
      },
      {
        name: "qa_visual_diff",
        category: "qa-performance",
        description: "Compare two screenshots and return a visual diff report",
      },
      {
        name: "qa_api_test",
        category: "qa-performance",
        description: "Send an HTTP request and assert response status and body",
      },
      {
        name: "qa_generate_test",
        category: "qa-performance",
        description: "Generate a Vitest unit test scaffold for a given function",
      },
    ],
    features: [
      {
        title: "Browser Automation",
        description: "Headless browser control for automated testing",
        icon: "Monitor",
      },
      {
        title: "Accessibility Audits",
        description: "WCAG compliance checks with actionable violation reports",
        icon: "Eye",
      },
      {
        title: "Test Runner",
        description: "Execute Vitest suites with detailed failure analysis",
        icon: "Play",
      },
      {
        title: "Coverage Analysis",
        description: "Identify untested code with line-level coverage reports",
        icon: "BarChart3",
      },
    ],
  },

  // ─── 17. State Machine Studio ─────────────────────────────────────
  {
    id: "state-machine",
    slug: "state-machine",
    name: "State Machine Studio",
    tagline: "Visual statechart builder",
    description: "Design, simulate, and export hierarchical state machines with AI assistance.",
    longDescription:
      "An interactive builder for statecharts. Add states and transitions, simulate in real time, validate for dead ends, and export as JSON. Start from templates or generate machines from natural language.",
    category: "developer",
    cardVariant: "purple",
    icon: "Workflow",
    appUrl: "/apps/state-machine",
    mcpServerUrl: getAppMcpUrl("state-machine"),
    isFeatured: true,
    isFirstParty: true,
    isCodespaceNative: false,
    toolCount: 20,
    tags: ["state-machine", "statechart", "workflow", "fsm", "visualization", "ai"],
    color: "purple",
    mcpTools: [
      {
        name: "sm_create",
        category: "state-machine",
        description: "Create a new state machine with name, initial state, and context",
      },
      {
        name: "sm_add_state",
        category: "state-machine",
        description: "Add a state (atomic, compound, parallel, final, history) to a machine",
      },
      {
        name: "sm_remove_state",
        category: "state-machine",
        description: "Remove a state and all referencing transitions",
      },
      {
        name: "sm_add_transition",
        category: "state-machine",
        description: "Add a transition with event, guard, and actions",
      },
      {
        name: "sm_remove_transition",
        category: "state-machine",
        description: "Remove a transition by ID",
      },
      {
        name: "sm_set_context",
        category: "state-machine",
        description: "Merge values into the machine's extended state context",
      },
      {
        name: "sm_send_event",
        category: "state-machine",
        description: "Send an event to trigger state transitions",
      },
      {
        name: "sm_get_state",
        category: "state-machine",
        description: "Get current active states and context",
      },
      {
        name: "sm_get_history",
        category: "state-machine",
        description: "Get the transition log history",
      },
      {
        name: "sm_reset",
        category: "state-machine",
        description: "Reset machine to initial state and clear history",
      },
      {
        name: "sm_validate",
        category: "state-machine",
        description: "Validate machine definition and return issues",
      },
      {
        name: "sm_export",
        category: "state-machine",
        description: "Export full machine state for serialization",
      },
      {
        name: "sm_visualize",
        category: "state-machine",
        description: "Generate a React+D3 visualizer component",
      },
      {
        name: "sm_list",
        category: "state-machine",
        description: "List all machines for the current user",
      },
      {
        name: "sm_share",
        category: "state-machine",
        description: "Share a state machine via a unique link",
      },
      {
        name: "sm_get_shared",
        category: "state-machine",
        description: "Get a shared state machine by its share token",
      },
      {
        name: "sm_list_templates",
        category: "sm-templates",
        description: "List available state machine templates by category",
      },
      {
        name: "sm_create_from_template",
        category: "sm-templates",
        description: "Create a new state machine from a template",
      },
      {
        name: "sm_generate_code",
        category: "sm-templates",
        description: "Generate XState v5 TypeScript code for a state machine",
      },
      {
        name: "sm_simulate_sequence",
        category: "sm-templates",
        description: "Simulate a sequence of events through a state machine",
      },
    ],
    features: [
      {
        title: "Visual Builder",
        description: "Design state machines with colored states and transitions",
        icon: "MousePointer",
      },
      {
        title: "Live Simulation",
        description: "Send events and watch transitions animate live",
        icon: "Play",
      },
      {
        title: "AI Assistant",
        description: "Generate machines from text descriptions via AI",
        icon: "Sparkles",
      },
      {
        title: "Templates",
        description: "Pre-built patterns for auth, cart, retry, and more",
        icon: "LayoutTemplate",
      },
      {
        title: "Multi-Machine Tabs",
        description: "Work on multiple machines in a tabbed workspace",
        icon: "Layers",
      },
      {
        title: "Import / Export",
        description: "Share machines as JSON and replay event sequences",
        icon: "Download",
      },
    ],
  },

  // ─── 20. MCP Explorer ──────────────────────────────────────────────
  {
    id: "mcp-explorer",
    slug: "mcp-explorer",
    name: "MCP Explorer",
    tagline: "MCP app playground",
    description: "Browse, search, and try every app's capabilities live — no setup required.",
    longDescription:
      "The developer playground for spike.land's app ecosystem. Browse apps by category, search capabilities, and test them live in the built-in terminal. Includes a step-by-step guide for connecting Claude, Cursor, or any MCP client.",
    category: "developer",
    cardVariant: "blue",
    icon: "Terminal",
    appUrl: "/apps/mcp-explorer",
    mcpServerUrl: getAppMcpUrl("mcp-explorer"),
    isFeatured: true,
    isFirstParty: true,
    toolCount: 12,
    tags: ["mcp", "developer-tools", "playground", "api-explorer", "interactive"],
    color: "blue",
    mcpTools: [
      {
        name: "search_tools",
        category: "gateway-meta",
        description: "Search all available tools by keyword or description",
      },
      {
        name: "list_categories",
        category: "gateway-meta",
        description: "List all tool categories with tool counts and metadata",
      },
      {
        name: "enable_category",
        category: "gateway-meta",
        description: "Activate all tools in a specific category",
      },
      {
        name: "get_status",
        category: "gateway-meta",
        description: "Get platform status including available features and tool counts",
      },
      {
        name: "get_balance",
        category: "gateway-meta",
        description: "Get the current token balance for AI operations",
      },
      {
        name: "mcp_registry_search",
        category: "mcp-registry",
        description: "Search Smithery, Official MCP Registry, and Glama for MCP servers",
      },
      {
        name: "mcp_registry_get",
        category: "mcp-registry",
        description: "Get detailed information about a specific MCP server",
      },
      {
        name: "mcp_registry_install",
        category: "mcp-registry",
        description: "Auto-configure an MCP server by generating a .mcp.json entry",
      },
      {
        name: "mcp_registry_list_installed",
        category: "mcp-registry",
        description: "List all currently configured MCP servers from .mcp.json",
      },
      {
        name: "mcp_tool_usage_stats",
        category: "mcp-analytics",
        description: "Get usage statistics for MCP tools across the platform",
      },
      {
        name: "mcp_generate_docs",
        category: "mcp-analytics",
        description: "Generate markdown documentation for a registered MCP tool",
      },
      {
        name: "mcp_health_check",
        category: "mcp-analytics",
        description: "Check health and latency of MCP server endpoints",
      },
    ],
    features: [
      {
        title: "Interactive Terminal",
        description: "Try any tool live with autocomplete and formatting",
        icon: "Terminal",
      },
      {
        title: "Tool Registry",
        description: "Browse tools organized by category and sub-category",
        icon: "Search",
      },
      {
        title: "Progressive Disclosure",
        description: "Start broad and drill into exactly what you need",
        icon: "Layers",
      },
      {
        title: "Integration Guide",
        description: "Step-by-step setup for Claude, Cursor, and more",
        icon: "BookOpen",
      },
    ],
  },
];

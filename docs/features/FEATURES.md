# spike.land — Features

## Platform overview

spike.land is a workspace platform where AI agents build, deploy, and manage
full-stack applications. Each workspace is personalized based on a 4-question
onboarding flow (16 personas). The platform exposes all business logic as MCP
tools — 455+ tools across 15+ categories.

**Live at**: [spike.land](https://spike.land) **Company**: SPIKE LAND LTD — UK
Company #16906682

---

## Core features

### Personalized workspaces

4 binary onboarding questions produce 16 personas. Each persona maps to a
different set of recommended apps, homepage layout, and hero copy. Workspaces
diverge further over time as users build tools, install apps, and configure
themes.

- **Source**: `src/spike-land-mcp/tools/` (onboarding tools)
- **Question flow**: Code? → Solo/Team → Learning/Shipping → specific persona
- **Non-dev branch**: Business/Personal → Solo/Team → specific persona

### Tool Factory (self-extending agent)

Agents register custom HTTP proxy tools scoped to a workspace at runtime. Tool
handlers are declarative specs (URL, method, headers, body template) — no
arbitrary code execution.

- **Source**: `src/spike-land-mcp/tools/` (tool factory)
- **Security**: HTTPS-only, SSRF prevention (private IP blocking), template
  variable validation (`{{secrets.KEY}}`, `{{input.FIELD}}` only)
- **Limits**: 5 tools (free), 500 tools (premium)

### A/B testing engine

z-test with pooled proportions. 95% confidence threshold. Runs on prompts, UI
layouts, app configurations, and MCP tool outputs.

- **Source**: `src/spike-land-mcp/tools/store/ab.ts`
- **Tools**: create test, get results, check significance, declare winner, list
  active tests

### Page AI (frontend generation)

5 MCP tools that generate complete pages from text prompts.

- **Source**: `src/spike-land-mcp/tools/` (page-ai tools)
- **Tools**: generate page, enhance block, suggest layout, generate theme,
  populate store
- **Layouts**: Landing, Feature, Store, Dashboard, Article, Gallery, Custom
- **Themes**: Modern, Minimal, Bold, Playful

### White-label theming

CSS custom properties generated from workspace config. Tailwind-compatible.
Runtime theme objects for React.

- **Source**: `src/spike-land-mcp/tools/` (theme tools)
- **Features**: Primary/secondary/accent colors, custom fonts, logo/favicon,
  "powered by" toggle, alpha channel support

---

## spike-cli

A model-agnostic coding agent and MCP multiplexer CLI.

- **Package**: `@spike-land-ai/spike-cli` (external repo)
- **Install**: `npx @spike-land-ai/spike-cli`
- **Transport**: stdio, SSE, HTTP

### Commands

| Command                                | Description                                          |
| -------------------------------------- | ---------------------------------------------------- |
| `spike serve [options]`                | Start MCP multiplexer server (stdio by default)      |
| `spike shell [options]`                | Interactive REPL to explore and call MCP tools       |
| `spike chat`                           | Interactive AI chat session with MCP tools available |
| `spike auth login\|logout\|status`     | Manage authentication with spike.land                |
| `spike alias set\|remove\|list`        | Manage command aliases                               |
| `spike completions install\|uninstall` | Shell tab completions (bash, zsh, fish)              |
| `spike registry search\|add`           | Browse and add MCP servers from registry             |
| `spike status`                         | Health check for configured MCP servers              |

### MCP Multiplexer

Aggregates multiple MCP servers into a single interface with namespace
isolation, lazy toolset loading, and automatic reconnection with exponential
backoff. Works with any MCP-compatible client (Claude, Cursor, etc.).

#### Why Lazy Toolset Loading

AI agents work best with small, relevant tool lists. An LLM presented with
hundreds of tool definitions wastes context parsing tools it will never use.
spike-cli groups tools into named toolsets that load on demand — only gateway
tools are visible by default. The agent requests a toolset when needed, keeping
the context window focused on signal. Result: better decisions, lower token
cost.

- **Source**: `@spike-land-ai/spike-cli` (external repo, `src/multiplexer/`)
- **Components**: `multiplexer-server.ts`, `namespace.ts`, `reconnect.ts`,
  `server-manager.ts`, `toolset-manager.ts`, `upstream-client.ts`

---

## App Store

18 store app listings (19 first-party app directories) across 6 categories at
[spike.land/store](https://spike.land/store). Each workspace gets different app
recommendations based on onboarding persona. 46 Storybook pages provide visual
documentation for app components.

**Data source**: `src/app/store/data/store-apps.ts`

### Categories

| Category      | Apps                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| Creative      | Audio Studio, Page Builder, Music Creator                               |
| Productivity  | Content Hub                                                             |
| Developer     | Ops Dashboard, CodeSpace, QA Studio, State Machine Studio, MCP Explorer |
| Communication | Tabletop Sim, Display Wall, Chess Arena                                 |
| Lifestyle     | CleanSweep, Career Navigator, beUniq                                    |
| AI Agents     | AI Orchestrator, App Creator                                            |

---

### Creative

#### Audio Studio

Multi-track audio mixing and AI voice synthesis.

| Tool              | Description                                       |
| ----------------- | ------------------------------------------------- |
| `upload_track`    | Upload an audio file as a new track               |
| `list_tracks`     | List all tracks with metadata and duration        |
| `mix_tracks`      | Mix selected tracks with volume, pan, and effects |
| `generate_speech` | Text-to-speech using a selected voice model       |
| `list_voices`     | List available voice models                       |
| `clone_voice`     | Create a custom voice model from an audio sample  |

**Route**: `/apps/audio-mixer`

#### Page Builder

Visual page editor with AI generation and block library.

| Tool               | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `create_page`      | Create a page with title, layout, and initial content |
| `update_page`      | Update page metadata, SEO, and layout                 |
| `publish_page`     | Publish a draft page                                  |
| `add_block`        | Add a content block (text, image, video, CTA)         |
| `update_block`     | Modify an existing block's content or styling         |
| `reorder_blocks`   | Rearrange block order within a section                |
| `ai_generate_page` | Generate a complete page from a text description      |
| `ai_enhance_block` | AI-improve copy, styling, or structure of a block     |
| `ai_create_theme`  | Generate a theme from brand colors and mood keywords  |

**Route**: `/apps/page-builder` | **CodeSpace-native**: yes

#### Music Creator

Audio layering and microphone recording.

| Tool                   | Description                  |
| ---------------------- | ---------------------------- |
| `list_music_projects`  | List all music projects      |
| `create_music_project` | Create a new project         |
| `record_audio_clip`    | Record audio from microphone |

**Route**: `/apps/music-creator`

---

### Productivity

#### Content Hub

Blog CMS, newsletter builder, and SEO tools.

| Tool                 | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `create_post`        | Create a blog post with title, content, tags, SEO metadata |
| `publish_post`       | Publish immediately or schedule for later                  |
| `list_posts`         | List posts with status, date, and engagement metrics       |
| `create_newsletter`  | Create a newsletter from a template                        |
| `send_newsletter`    | Send newsletter to subscriber list with tracking           |
| `manage_subscribers` | Add, remove, and segment subscribers                       |

**Route**: `/blog` | **CodeSpace-native**: yes

---

### Developer

#### Ops Dashboard

Production monitoring across Vercel, Sentry, GitHub, and environment variables.

| Tool                  | Category | Description                                     |
| --------------------- | -------- | ----------------------------------------------- |
| `list_deployments`    | vercel   | List deployments with status, URL, commit info  |
| `deploy_project`      | vercel   | Trigger deployment from a branch                |
| `rollback_deployment` | vercel   | Revert to a previous deployment                 |
| `get_deployment_logs` | vercel   | Stream build and runtime logs                   |
| `list_issues`         | sentry   | Retrieve unresolved issues by frequency/impact  |
| `resolve_issue`       | sentry   | Mark issue as resolved                          |
| `get_error_details`   | sentry   | Full stack traces and breadcrumbs               |
| `create_alert_rule`   | sentry   | Set up error threshold alerting                 |
| `repo_stats`          | github   | Repository stats, commit activity, contributors |
| `branch_protection`   | github   | View/configure branch protection rules          |
| `merge_queue_status`  | github   | Check merge queue and pending PRs               |
| `release_create`      | github   | Create release with auto-generated changelog    |
| `list_env_vars`       | env      | List env vars across environments               |
| `set_env_var`         | env      | Create/update env var                           |
| `rotate_secret`       | env      | Generate and apply new secret value             |
| `env_diff`            | env      | Compare env vars between environments           |

**Route**: `/admin/system` | **CodeSpace-native**: yes

#### CodeSpace

Browser-based React code editor with live preview, virtual filesystem, and AI
code generation.

| Tool            | Description                                      |
| --------------- | ------------------------------------------------ |
| `read_file`     | Read file from virtual filesystem                |
| `write_file`    | Create/overwrite a file                          |
| `edit_file`     | Search-and-replace edits                         |
| `glob_files`    | Find files by glob pattern                       |
| `grep_files`    | Search file contents with regex                  |
| `create_app`    | Generate a React app from text description       |
| `search_apps`   | Search existing apps                             |
| `classify_idea` | Classify app idea for best template/architecture |

**Route**: `/create` | **Featured**: yes

#### QA Studio

Browser automation, accessibility audits, test runner, and coverage analysis.

| Tool                         | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `browser_navigate`           | Navigate browser session to a URL                  |
| `browser_screenshot`         | Screenshot current viewport                        |
| `browser_click`              | Click element by selector/coordinates              |
| `browser_type`               | Type text into focused element                     |
| `browser_session_status`     | Check browser session status                       |
| `accessibility_audit`        | WCAG accessibility audit on a URL                  |
| `accessibility_audit_status` | Check audit job status                             |
| `run_tests`                  | Execute Vitest suites with structured reporting    |
| `analyze_coverage`           | Analyze coverage, identify untested lines/branches |
| `list_tests`                 | Discover test files across project                 |

**Route**: `/apps/qa-studio`

#### State Machine Studio

Visual statechart builder with live simulation, AI generation, guard conditions,
action handlers, and templates (Traffic Light, Auth Flow, HTTP Request, etc.).

| Tool                   | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `sm_create`            | Create machine with name, initial state, context       |
| `sm_add_state`         | Add state (atomic, compound, parallel, final, history) |
| `sm_remove_state`      | Remove state and referencing transitions               |
| `sm_add_transition`    | Add transition with event, guard, actions              |
| `sm_remove_transition` | Remove transition by ID                                |
| `sm_set_context`       | Merge values into extended state context               |
| `sm_send_event`        | Send event to trigger transitions                      |
| `sm_get_state`         | Get current active states and context                  |
| `sm_get_history`       | Get transition log                                     |
| `sm_reset`             | Reset to initial state                                 |
| `sm_validate`          | Validate machine definition                            |
| `sm_export`            | Export machine for serialization                       |
| `sm_visualize`         | Generate React+D3 visualizer component                 |
| `sm_list`              | List all machines for current user                     |

**Route**: `/apps/state-machine` | **Featured**: yes

#### MCP Explorer

Interactive playground for browsing, searching, and testing all MCP tools.

| Tool                  | Description                                   |
| --------------------- | --------------------------------------------- |
| `mcp_list_tools`      | List all available MCP tools                  |
| `mcp_call_tool`       | Execute any MCP tool by name                  |
| `mcp_list_categories` | List tool categories with counts              |
| `mcp_search_tools`    | Search tools by name/description/category     |
| `mcp_get_tool_schema` | Get full input schema for a tool              |
| `mcp_list_resources`  | List available MCP resources                  |
| `mcp_read_resource`   | Read MCP resource by URI                      |
| `mcp_server_info`     | Server version, capabilities, connection info |

**Route**: `/apps/mcp-explorer` | **Featured**: yes

---

### Communication

#### Tabletop Sim

Virtual tabletop for board games and RPGs with multiplayer rooms, dice, and
voice chat.

| Tool          | Description                                    |
| ------------- | ---------------------------------------------- |
| `create_room` | Create game room with template and invite link |
| `join_room`   | Join room via code or invite link              |
| `roll_dice`   | Roll with configurable sides, count, modifiers |
| `move_piece`  | Move game piece on board grid                  |

**Route**: `/apps/tabletop-simulator` | **CodeSpace-native**: yes

#### Display Wall

Real-time collaborative multi-screen display.

| Tool             | Description                                    |
| ---------------- | ---------------------------------------------- |
| `create_display` | Create display wall with resolution and layout |
| `add_content`    | Add content source (image, video, URL, widget) |
| `manage_layout`  | Arrange and resize content zones               |

**Route**: `/apps/display` | **CodeSpace-native**: yes

#### Chess Arena

Multiplayer chess with ELO ratings, time controls (bullet to classical),
challenges, and game replay.

| Tool                      | Category  | Description                       |
| ------------------------- | --------- | --------------------------------- |
| `chess_create_game`       | game      | Create game with time controls    |
| `chess_join_game`         | game      | Join as black player              |
| `chess_make_move`         | game      | Make a move                       |
| `chess_get_game`          | game      | Get game state with move history  |
| `chess_list_games`        | game      | List games with status filter     |
| `chess_resign`            | game      | Resign from active game           |
| `chess_offer_draw`        | game      | Offer draw                        |
| `chess_accept_draw`       | game      | Accept draw offer                 |
| `chess_create_player`     | player    | Create player profile with avatar |
| `chess_get_player`        | player    | Get player profile                |
| `chess_list_profiles`     | player    | List all player profiles          |
| `chess_update_player`     | player    | Update profile settings           |
| `chess_get_stats`         | player    | Get detailed player statistics    |
| `chess_list_online`       | player    | List online players in lobby      |
| `chess_send_challenge`    | challenge | Challenge another player          |
| `chess_accept_challenge`  | challenge | Accept challenge                  |
| `chess_decline_challenge` | challenge | Decline challenge                 |
| `chess_cancel_challenge`  | challenge | Cancel sent challenge             |
| `chess_list_challenges`   | challenge | List pending challenges           |
| `chess_replay_game`       | replay    | Full move-by-move replay          |
| `chess_get_leaderboard`   | replay    | Top players by ELO                |

**Route**: `/apps/chess-arena`

---

### Lifestyle

#### CleanSweep

ADHD-friendly gamified room cleaning with AI room scanning, task generation,
streaks, and photo verification.

| Tool                 | Category  | Description                                     |
| -------------------- | --------- | ----------------------------------------------- |
| `upload_photo`       | photo     | Upload room photo for AI analysis               |
| `get_photo_analysis` | photo     | Retrieve AI analysis results                    |
| `scan_room`          | scanner   | AI-identify mess zones and priorities           |
| `get_scan_results`   | scanner   | Detailed scan results with severity scores      |
| `create_task`        | tasks     | Create cleaning task with duration estimate     |
| `list_tasks`         | tasks     | List pending tasks by priority/location         |
| `complete_task`      | tasks     | Mark task done with optional verification photo |
| `skip_task`          | tasks     | Skip and reschedule with reason                 |
| `get_streak`         | streaks   | Current streak count and history                |
| `update_streak`      | streaks   | Update streak based on daily completion         |
| `set_reminder`       | reminders | Set reminder with time and frequency            |
| `list_reminders`     | reminders | List active reminders                           |
| `verify_clean`       | verify    | Submit after photo for AI verification          |
| `get_motivation`     | motivate  | Personalized motivational message               |

**Route**: `/clean` | **Featured**: yes

#### Career Navigator

Skills assessment, occupation search (ESCO taxonomy), salary data, and job
listings.

| Tool                 | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `assess_skills`      | Skills assessment with strengths, gaps, career fit scores |
| `search_occupations` | Search occupations by skills/interests/keywords           |
| `salary_data`        | Salary ranges by occupation and region                    |
| `job_listings`       | Job listings matching skill profile                       |

**Route**: `/career` | **CodeSpace-native**: yes

#### beUniq

A game where you answer yes/no questions, navigating an AVL tree until your
combination of answers is unique. AI generates new differentiating questions
when players collide.

| Tool                        | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `profile_start`             | Begin profiling — returns first question or existing profile |
| `profile_answer`            | Answer yes/no, get next question                             |
| `profile_get`               | Retrieve profile with answer path, tags, tree position       |
| `profile_tree_stats`        | Community stats: total players, tree depth, node counts      |
| `profile_generate_question` | Generate differentiating question on collision               |
| `profile_reset`             | Reset profile to play again                                  |

**Route**: `/apps/be-uniq` | **Featured**: yes

---

### AI Agents

#### AI Orchestrator

Multi-agent swarm management: task decomposition, sandboxed execution, context
packing.

| Tool             | Description                                     |
| ---------------- | ----------------------------------------------- |
| `spawn_agent`    | Spawn agent with role, instructions, tools      |
| `list_agents`    | List active agents with status and current task |
| `stop_agent`     | Stop agent and collect final output             |
| `broadcast`      | Send message to all active agents               |
| `redirect`       | Redirect task between agents                    |
| `pack_context`   | Compress context for agent consumption          |
| `run_sandbox`    | Execute agent code in isolated sandbox          |
| `decompose_task` | Break task into dependency graph of subtasks    |

**Route**: `/bazdmeg/orchestrator` | **CodeSpace-native**: yes

#### App Creator

AI app builder — describe what you want, get a working React app.

| Tool            | Description                                          |
| --------------- | ---------------------------------------------------- |
| `create_app`    | Generate React app from natural language description |
| `chat_with_app` | Iterate on app via chat about desired changes        |
| `list_apps`     | List apps with status, version, deployment info      |
| `update_app`    | Update app with new features/modifications           |
| `delete_app`    | Delete app and clean up resources                    |
| `batch_create`  | Generate multiple apps from a list of descriptions   |

**Route**: `/admin/app-factory` | **CodeSpace-native**: yes | **Featured**: yes

---

## Social integrations

### TikTok

4 API routes for TikTok social integration: connect, callback, metrics, and
posts. Enables content creators to link their TikTok accounts and track
engagement metrics from within the platform.

- **Routes**: `src/app/api/social/tiktok/connect`, `callback`, `metrics`,
  `posts`
- **Features**: OAuth connect flow, engagement metrics dashboard, post listing

---

## Platform resilience

### Error boundaries

16 `error.tsx` files and 23 `loading.tsx` files provide comprehensive error
handling and loading states across the application. Every major route segment
has graceful error recovery.

### Storybook pages

46 Storybook pages document and visually test app components. 12 app storybook
pages were added in February 2026 with accompanying unit tests.

---

## Technical stack

| Layer         | Technology                                       |
| ------------- | ------------------------------------------------ |
| Framework     | Next.js 16 (App Router)                          |
| Language      | TypeScript (strict mode)                         |
| Styling       | Tailwind CSS 4 + shadcn/ui                       |
| Database      | Cloudflare D1 + Drizzle ORM                      |
| Auth          | Better Auth (GitHub, Google, Facebook, Apple)    |
| Payments      | Stripe (subscriptions + one-time)                |
| Cache         | Cloudflare KV                                    |
| Workers       | Cloudflare Workers + Durable Objects             |
| Real-time     | WebSockets, PeerJS                               |
| Transpilation | esbuild-wasm                                     |
| AI            | Claude Opus 4.6, Gemini, Stable Diffusion        |
| CI/CD         | GitHub Actions + Cloudflare Workers              |

## Related docs

| Topic              | Document                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| Subscription Tiers | [SUBSCRIPTION_TIERS.md](./SUBSCRIPTION_TIERS.md)                       |
| Business Structure | [../business/BUSINESS_STRUCTURE.md](../business/BUSINESS_STRUCTURE.md) |

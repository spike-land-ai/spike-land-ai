# Apps Architecture

This document provides comprehensive developer documentation for the `/my-apps`
feature in spike.land.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Next.js Application (spike.land)](#nextjs-application-spikeland)
- [testing.spike.land (Cloudflare Worker)](#testingspikeland-cloudflare-worker)
- [MCP Integration](#mcp-integration)
- [Data Flow](#data-flow)
- [Local Development](#local-development)
- [Production Architecture](#production-architecture)
- [Key Files Reference](#key-files-reference)

---

## Overview

**My-Apps** (`/my-apps`) is a dashboard where users can create, manage, and
interact with AI-powered React applications. The platform also includes an **App
Store** (`/store`) with 18 store app listings (19 first-party app directories),
a **Chess Arena**, **State Machine Engine**, **QA Studio**, and other
specialized apps. 46 Storybook pages document app components, and 16 error.tsx /
23 loading.tsx boundaries provide resilience. It provides:

- **App Creation**: Users describe what they want to build, and an AI agent
  writes the code
- **Live Preview**: Real-time iframe preview of running React applications
- **Chat Interface**: Conversational UI to iterate on the app with AI assistance
- **Persistent Storage**: Apps are saved and can be resumed anytime

### Three-Tier Architecture

The feature spans three interconnected systems:

| System                 | Purpose                                                | URL                             |
| ---------------------- | ------------------------------------------------------ | ------------------------------- |
| **spike.land**         | Next.js app - User dashboard, authentication, database | `https://spike.land`            |
| **testing.spike.land** | Cloudflare Worker - Live codespace hosting             | `https://testing.spike.land`    |
| **MCP Server**         | Model Context Protocol - AI agent tools                | npm: `@spike-land-ai/spike-cli` |

---

## Conceptual Model: MCP Interface

### Key Insight: Same Tools, Different Interfaces

My-Apps and Claude Desktop are **two interfaces to the same MCP layer**. This
architectural choice means:

- Features built for My-Apps are automatically available to Claude users
- AI agents in Claude Code have the same capabilities as the My-Apps chat
- Users can switch between interfaces without losing functionality

```
+------------------+     +------------------+
|    My-Apps UI    |     | Claude Desktop   |
|  (Web Interface) |     |  (Native App)    |
+--------+---------+     +--------+---------+
         |                        |
         |  Chat with AI          |  Natural language
         |                        |
         v                        v
+--------------------------------------------------+
|            MCP Server Layer                       |
|                                                   |
|  +-------------+  +-------------+  +------------+|
|  | codespace_  |  | generate_   |  | apply_     ||
|  | update      |  | image       |  | brand_style||
|  +-------------+  +-------------+  +------------+|
|                                                   |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|            Backend Services                       |
|  - testing.spike.land (codespaces)               |
|  - spike.land/api (image gen, brand brain)       |
+--------------------------------------------------+
```

### What My-Apps Adds

While Claude Desktop gives raw access to MCP tools, My-Apps provides:

| Feature             | My-Apps | Claude Desktop |
| ------------------- | ------- | -------------- |
| Live app preview    | ✅      | ❌             |
| App version history | ✅      | ❌             |
| App organization    | ✅      | ❌             |
| Shareable app links | ✅      | ❌             |
| Raw MCP tool access | ✅      | ✅             |

---

## Architecture

```
                           +------------------+
                           |   User Browser   |
                           +--------+---------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                        spike.land (Next.js on AWS ECS)                 |
|                                                                       |
|  +------------------+    +------------------+    +------------------+ |
|  |    /my-apps      |    |  /my-apps/[id]   |    |  /api/apps/*     | |
|  |  (App Listing)   |    | (Chat+Preview)   |    |  (REST API)      | |
|  +--------+---------+    +--------+---------+    +--------+---------+ |
|           |                       |                       |           |
|           +-----------+-----------+-----------+-----------+           |
|                       |                       |                       |
|                       v                       v                       |
|  +--------------------+-----+   +------------+------------------------+
|  |   PostgreSQL (Prisma)    |   |  Claude Agent SDK                  |
|  |   - App table            |   |  - MCP Server integration          |
|  |   - AppMessage table     |   |  - Streaming responses             |
|  |   - AppStatusHistory     |   +------------+-----------------------+
|  +--------------------+-----+                |
+-----------------------------------------------------------------------+
                        |                      |
                        | codespaceUrl         | REST API calls
                        | (iframe embed)       | (read/update code)
                        v                      v
+-----------------------------------------------------------------------+
|               testing.spike.land (Cloudflare Worker)                  |
|                                                                       |
|  +------------------+    +------------------+    +------------------+ |
|  | /live/{id}/      |    | /live/{id}/api/* |    |      /mcp        | |
|  | (HTML renderer)  |    | (Code CRUD)      |    | (MCP Protocol)   | |
|  +--------+---------+    +--------+---------+    +--------+---------+ |
|           |                       |                       |           |
|           +-----------+-----------+-----------+-----------+           |
|                                   |                                   |
|                                   v                                   |
|                  +----------------+----------------+                   |
|                  |    Durable Object (Code class) |                   |
|                  |    - Session state per codespace|                  |
|                  |    - WebSocket broadcasts       |                  |
|                  |    - MCP tool execution         |                  |
|                  +----------------+----------------+                   |
|                                   |                                   |
+-----------------------------------------------------------------------+
                                    |
                    +---------------+---------------+
                    |               |               |
                    v               v               v
              +----------+   +----------+   +-------------+
              |    KV    |   |    R2    |   | js.spike.land|
              | (Cache)  |   | (Storage)|   | (Transpiler) |
              +----------+   +----------+   +-------------+
```

---

## Next.js Application (spike.land)

### Pages

#### `/my-apps/page.tsx` - App Listing (Server Component)

The main dashboard showing all user's apps.

**Location**: `src/app/my-apps/page.tsx`

**Features**:

- Server-side data fetching from Prisma
- Authentication check (redirects to `/auth/signin` if not logged in)
- Filters out `ARCHIVED` apps and apps without messages (drafts)
- Displays apps as 3D cards with live iframe previews

**Data fetched**:

```typescript
const apps = await prisma.app.findMany({
  where: {
    userId: session.user.id,
    status: { notIn: ["ARCHIVED"] },
    messages: { some: {} },
  },
  select: {
    id,
    name,
    slug,
    description,
    status,
    codespaceId,
    codespaceUrl,
    isCurated,
    isPublic,
    _count: { messages, images },
  },
  orderBy: { updatedAt: "desc" },
});
```

#### `/my-apps/[id]/page.tsx` - App Workspace (Client Component)

The main workspace for interacting with an app.

**Location**: `src/app/my-apps/[id]/page.tsx`

**Layout**:

```
+---------------------------+---------------------------+
|                           |                           |
|      Chat Panel (50%)     |    Preview Panel (50%)    |
|                           |                           |
|  +---------------------+  |  +---------------------+  |
|  |  Message History    |  |  |  Browser Toolbar    |  |
|  |  - USER messages    |  |  |  [o][o][o] URL  [R] |  |
|  |  - AGENT responses  |  |  +---------------------+  |
|  |  - Streaming caret  |  |  |                     |  |
|  +---------------------+  |  |   iframe preview    |  |
|                           |  |   (scale: 0.5)      |  |
|  +---------------------+  |  |                     |  |
|  |  Image Upload       |  |  |  testing.spike.land |  |
|  +---------------------+  |  |  /live/{codespaceId}|  |
|  |  Text Input  [Send] |  |  |                     |  |
|  +---------------------+  |  +---------------------+  |
|                           |                           |
+---------------------------+---------------------------+
```

**Real-time Communication**:

- Uses SSE (Server-Sent Events) via `/api/apps/[id]/messages/stream`
- Events: `message`, `status`, `agent_working`, `code_updated`
- Auto-refreshes iframe when code is updated

#### `/my-apps/new/page.tsx` - New App Entry

Generates a random codespace ID and redirects to the draft workspace.

**Codespace ID Format**: `{adjective}.{noun}.{verb}.{suffix}`

- Example: `swift.spark.launch.a1b2`

#### `/my-apps/new/[tempId]/page.tsx` - Draft Workspace

Pre-creation workspace where users enter their initial prompt.

**Flow**:

1. Preview iframe points to `https://testing.spike.land/live/{tempId}/`
2. User enters initial prompt and submits
3. `POST /api/apps` creates the app with the codespaceId
4. Redirects to `/my-apps/[newAppId]`

### API Routes

#### `POST /api/apps` - Create App

**Location**: `src/app/api/apps/route.ts`

**Two modes**:

1. **Prompt-based** (new flow):

```typescript
{
  prompt: string,       // User's description
  codespaceId?: string, // Pre-allocated codespace ID
  imageIds?: string[]   // Optional attached images
}
```

Creates app with `status: WAITING`, creates first USER message.

2. **Legacy** (form-based):

```typescript
{
  name: string,
  description: string,
  requirements: string,
  monetizationModel: string,
  codespaceId?: string
}
```

Creates app with `status: PROMPTING`.

#### `POST /api/apps/[id]/agent/chat` - AI Interaction

**Location**: `src/app/api/apps/[id]/agent/chat/route.ts`

**Request**:

```typescript
{ content: string, imageIds?: string[] }
```

**Process**:

1. Creates USER message in database
2. Fetches current code from testing.spike.land
3. Initializes Claude Agent SDK with MCP server
4. Streams response chunks via SSE format
5. Saves AGENT message to database
6. Broadcasts `code_updated` event if code changed

#### `GET /api/apps/[id]/messages/stream` - Real-time Updates

**Location**: `src/app/api/apps/[id]/messages/stream/route.ts`

**Event types**:

```typescript
"connected"; // Initial connection
"message"; // New message
"status"; // App status change
"agent_working"; // Agent working indicator
"code_updated"; // Code modified (triggers iframe refresh)
"heartbeat"; // 30-second keep-alive
```

**Note**: Current implementation uses in-memory connections. Does not scale
across multiple multiple server instances. TODO: Implement Redis Pub/Sub.

### Components

#### `AppCard3D` - 3D Preview Card

**Location**: `src/components/my-apps/AppCard3D.tsx`

**Features**:

- 3D perspective rotation on mouse move
- Live iframe preview (400% size scaled to 25%)
- Lazy loading with skeleton
- Gradient overlay and shine effects

**Preview iframe**:

```tsx
<iframe
  src={app.codespaceUrl} // https://testing.spike.land/live/{id}/
  className="h-[400%] w-[400%]"
  style={{ transform: "scale(0.25)", transformOrigin: "0 0" }}
  sandbox="allow-scripts"
/>;
```

### Database Schema

**Location**: `prisma/schema.prisma`

```prisma
model App {
  id            String   @id @default(cuid())
  name          String
  slug          String?  @unique
  description   String?
  userId        String

  // Codespace linking
  codespaceId   String?  @unique
  codespaceUrl  String?

  status        AppBuildStatus @default(PROMPTING)
  // PROMPTING | WAITING | DRAFTING | BUILDING | TEST | FINE_TUNING | LIVE | ARCHIVED | FAILED

  messages        AppMessage[]
  statusHistory   AppStatusHistory[]
  images          AppImage[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model AppMessage {
  id        String         @id @default(cuid())
  appId     String
  role      AppMessageRole // USER | AGENT | SYSTEM
  content   String
  isRead    Boolean        @default(false)

  attachments AppAttachment[]

  createdAt DateTime @default(now())
}
```

---

## testing.spike.land (Cloudflare Worker)

### What It Is

**testing.spike.land** is a Cloudflare Worker that hosts live React
applications. Each "codespace" is an isolated environment where React code runs
in real-time.

**Key Technologies**:

- **Cloudflare Workers**: Serverless execution at the edge
- **Durable Objects**: Persistent state per codespace
- **KV**: Asset caching
- **R2**: Code history and storage
- **WebSockets**: Real-time sync between clients

### URL Structure

```
https://testing.spike.land/live/{codespaceId}/
├── (root)              GET   → Renders HTML with embedded React app
├── /api/code           GET   → Returns current code
├── /api/code           PUT   → Updates code, optional transpile
├── /api/run            POST  → Triggers transpilation
├── /api/screenshot     GET   → Captures JPEG screenshot
├── /api/session        GET   → Returns full session data
├── /index.tsx          GET   → Source code
├── /index.js           GET   → Transpiled JavaScript
├── /index.css          GET   → Styles
├── /session.json       GET   → Session metadata
├── /messages           GET/POST → AI message handling (legacy)
└── /mcp                POST  → MCP tool execution (deprecated)

Global MCP endpoint:
POST /mcp               → MCP protocol handler
```

### Durable Object: Code Class

**Location**: `@spike-land-ai/testing.spike.land` (external repo,
`src/chatRoom.ts`)

Each codespace has its own Durable Object instance that maintains:

```typescript
interface ICodeSession {
  codeSpace: string; // Unique identifier
  code: string; // Source TSX/JSX code
  transpiled: string; // Compiled JavaScript
  html: string; // Rendered HTML
  css: string; // Extracted styles
}
```

**Responsibilities**:

- Persistent state storage
- WebSocket broadcast to connected clients
- MCP server implementation for AI tools
- Route handling for API requests

### REST API Examples

**Get current code**:

```bash
curl https://testing.spike.land/live/my-app/session.json
```

**Update code**:

```bash
curl -X PUT https://testing.spike.land/live/my-app/api/code \
  -H "Content-Type: application/json" \
  -d '{"code": "export default () => <h1>Hello</h1>", "run": true}'
```

**Get screenshot**:

```bash
curl https://testing.spike.land/live/my-app/api/screenshot > screenshot.jpg
```

### Wrangler Configuration

The Cloudflare Worker configuration is now maintained in the external
`@spike-land-ai/testing.spike.land` repository.

---

## MCP Integration

### MCP Server in testing.spike.land

**Location**: `@spike-land-ai/testing.spike.land` (external repo, `src/mcp/`)

The Cloudflare Worker implements an MCP server that AI agents can connect to for
code manipulation.

**Endpoint**: `POST /mcp`

**Available Tools**:

| Tool                 | Description                         |
| -------------------- | ----------------------------------- |
| `read_code`          | Get the current source code         |
| `read_html`          | Get the rendered HTML               |
| `read_session`       | Get full session data               |
| `update_code`        | Replace the entire code             |
| `edit_code`          | Edit specific line ranges           |
| `search_and_replace` | Find and replace patterns           |
| `find_lines`         | Search for lines matching a pattern |

### Claude Agent SDK Integration

**Location**: `src/lib/claude-agent/tools/codespace-tools.ts`

When a user sends a message in the app workspace, the backend creates an MCP
server instance:

```typescript
export function createCodespaceServer(codespaceId: string) {
  return createSdkMcpServer({
    name: "codespace",
    version: "1.0.0",
    tools: [
      tool("read_code", "Read the current code...", {}, async () => {
        const code = await fetch(
          `https://testing.spike.land/live/${codespaceId}/session.json`,
        ).then((r) => r.json()).then((d) => d.code);
        return { content: [{ type: "text", text: code }] };
      }),
      tool(
        "update_code",
        "Replace the entire code...",
        { code: z.string() },
        async (args) => {
          await fetch(
            `https://testing.spike.land/live/${codespaceId}/api/code`,
            {
              method: "PUT",
              body: JSON.stringify({ code: args.code, run: true }),
            },
          );
          return { content: [{ type: "text", text: "success" }] };
        },
      ),
      // ... more tools
    ],
  });
}
```

### External MCP Server (@spike-land-ai/spike-cli)

**Package**: `@spike-land-ai/spike-cli` (external repo, published on npm)

A standalone MCP server package for Claude Desktop and Claude Code.

**Installation**:

```bash
claude mcp add spike-land --transport http https://spike.land/mcp
# Or interactive CLI:
npx @spike-land-ai/spike-cli shell
```

**Configuration** (Claude Desktop):

```json
{
  "mcpServers": {
    "spike-land": {
      "command": "npx",
      "args": ["@spike-land-ai/spike-cli"],
      "env": {
        "SPIKE_LAND_API_KEY": "sk_live_your_key"
      }
    }
  }
}
```

**Codespace Tools**:

| Tool                     | Description                      |
| ------------------------ | -------------------------------- |
| `codespace_update`       | Create/update a live React app   |
| `codespace_run`          | Transpile without code change    |
| `codespace_screenshot`   | Get JPEG preview                 |
| `codespace_get`          | Fetch current code and metadata  |
| `codespace_link_app`     | Link codespace to user's My-Apps |
| `codespace_list_my_apps` | List user's apps                 |

**Example - Link codespace to app**:

```typescript
// Using the tool
await callTool("codespace_link_app", {
  codespace_id: "my-cool-app",
  app_name: "My Cool App",
  app_description: "A React app built with AI",
});
// Creates app in spike.land linked to the codespace
```

---

## Data Flow

### Creating an App

```
User visits /my-apps/new
        │
        ▼
Frontend generates random codespaceId
(e.g., "bright.nexus.launch.f3a2")
        │
        ▼
Redirects to /my-apps/new/[tempId]
        │
        ▼
User types prompt and clicks Send
        │
        ▼
POST /api/apps
{
  prompt: "Build a todo app",
  codespaceId: "bright.nexus.launch.f3a2"
}
        │
        ▼
Backend creates App record:
- codespaceId: "bright.nexus.launch.f3a2"
- codespaceUrl: "https://testing.spike.land/live/bright.nexus.launch.f3a2/"
- status: "WAITING"
- First message: USER with prompt
        │
        ▼
Redirects to /my-apps/[newAppId]
        │
        ▼
Workspace loads with chat + preview iframe
```

### AI Interaction Flow

```
User sends message in workspace
        │
        ▼
POST /api/apps/[id]/agent/chat
{ content: "Add a delete button" }
        │
        ▼
Backend:
1. Creates USER message in DB
2. Fetches current code from testing.spike.land
3. Initializes Claude Agent with MCP server
        │
        ▼
Claude Agent:
1. Calls read_code tool
2. Analyzes current code
3. Calls update_code or search_and_replace
4. Returns explanation
        │
        ▼
Backend:
1. Streams response chunks (SSE format)
2. Saves AGENT message to DB
3. Broadcasts "code_updated" event
        │
        ▼
Frontend:
1. Displays streaming response
2. Receives "code_updated" event
3. Refreshes preview iframe
```

---

## Local Development

### Running the Next.js App

```bash
cd /Users/z/Developer/spike-land-ai/spike.land

# Install dependencies
yarn install

# Start dev server
yarn dev
# → http://localhost:3000
```

**What works locally**:

- My-Apps dashboard at `http://localhost:3000/my-apps`
- Database operations via local PostgreSQL
- Authentication flow

**What still uses production**:

- Live preview iframes load from `https://testing.spike.land`
- Code updates go to production Cloudflare Worker

### Running testing.spike.land Locally

The `testing.spike.land` Cloudflare Worker is now in an external repository
(`@spike-land-ai/testing.spike.land`). Clone that repo separately to run
locally.

The Next.js app can be configured to point to a local worker via environment
variable:

```typescript
// In src/lib/claude-agent/tools/codespace-tools.ts
const TESTING_SPIKE_LAND = process.env.TESTING_SPIKE_LAND_URL ||
  "https://testing.spike.land";
```

### Testing

```bash
# Next.js tests
yarn test:coverage
```

---

## Production Architecture

### Deployment

| Component          | Platform           | URL                          |
| ------------------ | ------------------ | ---------------------------- |
| spike.land         | AWS ECS            | `https://spike.land`         |
| testing.spike.land | Cloudflare Workers | `https://testing.spike.land` |
| Database           | Managed PostgreSQL | (internal)                   |
| Storage            | Cloudflare R2      | (internal)                   |

### Deployment Commands

```bash
# Deploy Next.js (handled by GitHub Actions → AWS ECS on push to main)
git push origin main

# Deploy testing.spike.land — now in external @spike-land-ai/testing.spike.land repo
```

### Environment Variables

**Next.js (AWS ECS)**:

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
CLAUDE_CODE_OAUTH_TOKEN=...
SPIKE_LAND_API_KEY=sk_live_...
```

**testing.spike.land (Cloudflare)**:

```
OPENAI_API_KEY=...
CLAUDE_CODE_OAUTH_TOKEN=...
```

---

## Key Files Reference

| Purpose               | File Path                                        |
| --------------------- | ------------------------------------------------ |
| **Next.js Pages**     |                                                  |
| Apps listing          | `src/app/my-apps/page.tsx`                       |
| App workspace         | `src/app/my-apps/[id]/page.tsx`                  |
| New app entry         | `src/app/my-apps/new/page.tsx`                   |
| Draft workspace       | `src/app/my-apps/new/[tempId]/page.tsx`          |
| **API Routes**        |                                                  |
| App CRUD              | `src/app/api/apps/route.ts`                      |
| App by ID             | `src/app/api/apps/[id]/route.ts`                 |
| Agent chat            | `src/app/api/apps/[id]/agent/chat/route.ts`      |
| SSE stream            | `src/app/api/apps/[id]/messages/stream/route.ts` |
| Messages              | `src/app/api/apps/[id]/messages/route.ts`        |
| Images                | `src/app/api/apps/[id]/images/route.ts`          |
| **Components**        |                                                  |
| App catalog           | `src/components/my-apps/AppCatalog.tsx`          |
| 3D card               | `src/components/my-apps/AppCard3D.tsx`           |
| **Database**          |                                                  |
| Prisma schema         | `prisma/schema.prisma`                           |
| **Cloudflare Worker** | _(external: @spike-land-ai/testing.spike.land)_  |
| **Claude Agent**      |                                                  |
| Codespace tools       | `src/lib/claude-agent/tools/codespace-tools.ts`  |
| **App Store**         |                                                  |
| Store data            | `src/app/store/data/store-apps.ts`               |
| Store components      | `src/app/store/components/`                      |
| Store page            | `src/app/store/page.tsx`                         |
| **Chess System**      |                                                  |
| Chess engine          | `src/lib/chess/engine.ts`                        |
| Chess ELO             | `src/lib/chess/elo.ts`                           |
| Game manager          | `src/lib/chess/game-manager.ts`                  |
| Player manager        | `src/lib/chess/player-manager.ts`                |
| Challenge manager     | `src/lib/chess/challenge-manager.ts`             |
| Chess types           | `src/lib/chess/types.ts`                         |
| Chess MCP tools       | `src/lib/mcp/server/tools/chess-*.ts`            |
| **State Machine**     |                                                  |
| SM engine             | `src/lib/state-machine/engine.ts`                |
| SM types              | `src/lib/state-machine/types.ts`                 |
| SM visualizer         | `src/lib/state-machine/visualizer-template.ts`   |
| SM MCP tools          | `src/lib/mcp/server/tools/state-machine.ts`      |
| **QA Studio**         |                                                  |
| QA library            | `src/lib/qa-studio/`                             |
| QA MCP tools          | `src/lib/mcp/server/tools/qa-studio.ts`          |
| QA app UI             | `src/app/apps/qa-studio/`                        |

---

## App Store

### Overview

The App Store (`/store`) is a marketplace showcasing 18 store app listings (19
first-party app directories) across 6 categories.

### Data Model

**Source of truth**: `src/app/store/data/store-apps.ts`

```typescript
interface StoreApp {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  longDescription: string;
  category: AppCategory; // "creative" | "productivity" | "developer" | "communication" | "lifestyle" | "ai-agents"
  cardVariant: CardVariant;
  icon: string;
  appUrl?: string;
  mcpServerUrl?: string;
  isFeatured: boolean;
  isFirstParty: boolean;
  toolCount: number;
  tags: string[];
  mcpTools: McpTool[];
  features: AppFeature[];
}
```

### Routes

| Route           | Purpose                                      |
| --------------- | -------------------------------------------- |
| `/store`        | App listing with category filters and search |
| `/store/[slug]` | Individual app detail page                   |
| `/store/skills` | MCP tools browser                            |

### Components

Located in `src/app/store/components/`:

- Store page layout and category navigation
- App cards with variant coloring
- Tool list display
- Feature showcase

### Helper Functions

```typescript
getAppBySlug(slug: string): StoreApp | undefined
getAppsByCategory(category: string): StoreApp[]
getFeaturedApps(): StoreApp[]
getStoreStats(): { appCount: number; toolCount: number }
```

---

## Chess System

### Overview

Chess Arena is a multiplayer chess system with ELO ratings, time controls,
player profiles, and game replay. It consists of 6 core library files and 4 MCP
tool files (21 tools total).

### Architecture

```
src/lib/chess/
├── engine.ts              # Game logic, move validation, check/checkmate
├── elo.ts                 # ELO rating calculations, K-factor
├── game-manager.ts        # Game lifecycle, state persistence
├── player-manager.ts      # Profile CRUD, stats, online status
├── challenge-manager.ts   # Challenge send/accept/decline/cancel
└── types.ts               # TypeScript interfaces

src/lib/mcp/server/tools/
├── chess-game.ts          # 8 tools: create, join, move, get, list, resign, offer_draw, accept_draw
├── chess-player.ts        # 6 tools: create, get, list_profiles, update, get_stats, list_online
├── chess-challenge.ts     # 5 tools: send, accept, decline, cancel, list
└── chess-replay.ts        # 2 tools: replay_game, get_leaderboard

src/app/apps/chess-arena/  # UI components
```

### Key Design Decisions

- **Local profiles (Netflix-style)**: Players create profiles per device, not
  tied to auth accounts. Enables casual play.
- **ELO system**: Standard ELO with configurable K-factor. Updates after each
  game completion.
- **Time controls**: Bullet (1-2 min), Blitz (3-5 min), Rapid (10-15 min),
  Classical (30+ min), Unlimited.
- **Challenge system**: Direct player-to-player challenges with optional time
  control configuration.

---

## State Machine Engine

### Overview

A general-purpose statechart engine for defining, executing, and visualizing
finite state machines. Used for workflow automation and process modeling.

### Architecture

```
src/lib/state-machine/
├── engine.ts              # Core engine: transitions, guards, actions
├── types.ts               # TypeScript interfaces for statecharts
└── visualizer-template.ts # HTML/SVG visualization generator

src/lib/mcp/server/tools/
└── state-machine.ts       # 14 MCP tools for statechart CRUD and execution
```

### Capabilities

| Feature           | Description                          |
| ----------------- | ------------------------------------ |
| State definitions | Named states with entry/exit actions |
| Transitions       | Event-driven state changes           |
| Guards            | Conditional logic on transitions     |
| History           | Full transition history tracking     |
| Visualization     | HTML/SVG statechart diagrams         |
| Export/Import     | Portable statechart definitions      |

---

## QA Studio

### Overview

A comprehensive QA toolkit combining browser automation, WCAG accessibility
audits, test execution, and code coverage analysis. All capabilities exposed as
MCP tools for AI-driven QA workflows.

### Architecture

```
src/lib/qa-studio/         # Core QA logic
src/lib/mcp/server/tools/
└── qa-studio.ts           # 10 MCP tools

src/app/apps/qa-studio/    # QA Studio app UI
```

### MCP Tools

| Tool                       | Category      | Description                         |
| -------------------------- | ------------- | ----------------------------------- |
| browser_navigate           | Browser       | Navigate to URL, capture page state |
| browser_screenshot         | Browser       | Viewport screenshot                 |
| browser_click              | Browser       | Click element by selector           |
| browser_type               | Browser       | Type text into elements             |
| browser_session_status     | Browser       | Session metadata                    |
| accessibility_audit        | Accessibility | WCAG compliance audit               |
| accessibility_audit_status | Accessibility | Audit job status                    |
| run_tests                  | Testing       | Execute Vitest suites               |
| analyze_coverage           | Testing       | Coverage analysis                   |
| list_tests                 | Testing       | Test file discovery                 |

### Integration with AI Agents

QA Studio tools are composable with AI orchestration. An AI agent can:

1. Navigate to a page (`browser_navigate`)
2. Take a screenshot (`browser_screenshot`)
3. Run accessibility audit (`accessibility_audit`)
4. Execute relevant tests (`run_tests`)
5. Analyze coverage gaps (`analyze_coverage`)

This enables fully automated QA workflows driven by AI agents.

---

## Troubleshooting

### Module Resolution for Live Apps

Live app iframes **must** point to `testing.spike.land/live/{codespaceId}/`
where the Cloudflare Worker correctly handles module resolution:

- **npm packages** (react, framer-motion, recharts, etc.) resolve to absolute
  `esm.sh` CDN URLs via the import map in the `@spike-land-ai/code` package
- **`@/` component `.mjs` files** (e.g., `/@/components/ui/card.mjs`) are served
  directly from testing.spike.land
- **`importMapReplace()`** converts bare specifiers in transpiled code to CDN
  URLs at serve-time (called in `codeRoutes.ts` and `liveRoutes.ts`)
- The `/api/codespace/{id}/embed` Next.js route exists for standalone use but
  sets `<base href="https://testing.spike.land/">` so relative paths resolve
  correctly

**Key constraint**: iframes cannot use `srcdoc` (Next.js CSP blocks inline
scripts) and cannot use same-origin embed routes for module loading (npm modules
and `@/` paths only exist on testing.spike.land).

### Common Issues

**Preview iframe not loading**:

- Check that `codespaceUrl` is set on the app
- Verify testing.spike.land is accessible
- Check browser console for CORS errors
- Ensure `frame-src` in `src/proxy.ts` includes `https://testing.spike.land`

**Agent not responding**:

- Verify `CLAUDE_CODE_OAUTH_TOKEN` is set
- Check `/api/apps/[id]/agent/chat` logs
- Ensure codespace exists on testing.spike.land

**SSE not working**:

- Check `/api/apps/[id]/messages/stream` endpoint
- Note: Doesn't scale across multiple server instances
- Check for client-side EventSource errors

**Local Cloudflare Worker issues**:

- The worker is in external repo `@spike-land-ai/testing.spike.land`
- Clone that repo and run `yarn dev:remote` to use production bindings
- Check `.dev.vars` has required API keys

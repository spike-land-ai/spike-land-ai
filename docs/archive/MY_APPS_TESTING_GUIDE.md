# My-Apps Testing Guide

This document provides step-by-step instructions for testing the /my-apps
functionality locally and on production.

## Architecture Overview

```
User Browser (localhost:3000/my-apps)
    ↓ (creates app with prompt)
POST /api/apps
    ↓ (saves to DB + enqueues to Redis)
Redis Queue (app:${appId}:pending_messages)
    ↓ (polled by agent)
Agent Poll Script (yarn agent:poll)
    ↓ (spawns Claude CLI with MCP config)
Claude CLI → MCP Server (@spike-land-ai/spike-cli)
    ↓ (calls codespace_update)
Backend Worker (testing.spike.land)
    ↓ (transpiles & runs React code)
POST /api/agent/apps/${appId}/respond
    ↓ (broadcasts via SSE)
User Browser (receives update, iframe refreshes)
```

## Prerequisites

### Local Testing

- ✅ Local dev server running: `yarn dev`
- ✅ Local agent polling: `yarn agent:poll`
- ✅ Environment variables in `.env.local`:
  - `DATABASE_URL` (PostgreSQL connection)
  - `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL`
  - `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN`
  - `SPIKE_LAND_API_KEY` (for MCP server)
  - `AGENT_API_KEY` (for agent → backend auth)

### Production Testing

- ✅ Production deployment at https://spike.land
- ✅ Agent polling on server/container: `yarn agent:poll:prod`
- ✅ Production environment variables configured in Vercel
- ✅ Backend worker deployed at https://testing.spike.land

## Test Cases

### Test 1: Create Simple Counter App (Local)

**Objective**: Verify basic app creation, agent processing, and preview
rendering

**Steps**:

1. Open browser to `http://localhost:3000/my-apps`
2. Click "Create New App" or navigate to `http://localhost:3000/my-apps/new`
3. System redirects to `/my-apps/[random-codespace-id]` (e.g.,
   `/my-apps/swift.forge.launch.x7k2`)
4. Enter prompt: "Create a simple counter app with increment and decrement
   buttons"
5. Press Enter or click "Start"
6. **Expected Results**:
   - "Agent Working" badge appears
   - Agent Progress Indicator shows stages: initialize → processing → complete
   - User message appears in chat (right-aligned, teal background)
   - Agent message appears in chat (left-aligned, white background)
   - MiniPreview component renders with iframe showing the counter app
   - Counter app is functional (buttons work)

**Verification Points**:

- [ ] Check agent poll logs: `tail -f /path/to/agent/logs`
- [ ] Verify Redis queue is empty: Use Redis CLI or check agent stats
- [ ] Inspect browser DevTools → Network → EventSource connection active
- [ ] Confirm iframe loads: `https://testing.spike.land/live/{codespace-id}/`

### Test 2: Create Calculator App (Local)

**Objective**: Test more complex UI generation

**Steps**:

1. Create new app at `/my-apps/new`
2. Enter prompt: "Build a colorful calculator with buttons for digits 0-9,
   operations (+, -, *, /), equals, and clear. Use a gradient background."
3. Submit prompt
4. **Expected Results**:
   - Calculator UI renders with all requested buttons
   - Display shows current calculation
   - Operations work correctly
   - Gradient background is applied

### Test 3: Create Todo List App (Local)

**Objective**: Test state management and form handling

**Steps**:

1. Create new app
2. Prompt: "Create a todo list app where I can add tasks, mark them complete
   with checkboxes, and delete them. Use Tailwind CSS for styling."
3. **Expected Results**:
   - Input field for new tasks
   - Add button functional
   - Tasks display in a list
   - Checkboxes toggle completion state
   - Delete buttons remove tasks

### Test 4: Create Data Dashboard (Local)

**Objective**: Test chart/visualization generation

**Steps**:

1. Create new app
2. Prompt: "Build a simple data dashboard with 3 colorful cards showing mock
   statistics (users, revenue, growth) and a bar chart using Recharts"
3. **Expected Results**:
   - Three stat cards display
   - Bar chart renders with sample data
   - Responsive layout works

### Test 5: Image Reference App (Local)

**Objective**: Test image attachment and vision capabilities

**Steps**:

1. Create new app with initial prompt: "I'll upload a UI mockup"
2. After app is created, attach an image (UI screenshot or design mockup)
3. Send message: "Create this UI design in React with Tailwind CSS"
4. **Expected Results**:
   - Image uploads successfully (preview shown)
   - Agent analyzes image
   - Generated UI matches the mockup visually

### Test 6: Production Smoke Test

**Objective**: Verify production deployment works end-to-end

**Prerequisites**:

- Ensure `yarn agent:poll:prod` is running on server
- Verify production env vars in Vercel dashboard

**Steps**:

1. Open `https://spike.land/my-apps` in browser
2. Sign in (if not authenticated)
3. Create new app: "Create a simple hello world app with a heading and a
   colorful button"
4. **Expected Results**:
   - Same flow as local testing
   - Preview iframe loads from `https://testing.spike.land/live/{codespace-id}/`
   - Agent responds within 30 seconds

**Critical Checks**:

- [ ] Check production agent logs: SSH to server and check agent process
- [ ] Verify Vercel deployment is live: `https://spike.land`
- [ ] Test SSE connection: Check Network tab for
      `/api/apps/{id}/messages/stream`

### Test 7: Multi-User Concurrent Testing (Production)

**Objective**: Verify agent handles multiple concurrent requests

**Steps**:

1. Open 3-5 browser tabs/windows (different users if possible)
2. In each tab, create a different app simultaneously:
   - Tab 1: "Counter app"
   - Tab 2: "Todo list"
   - Tab 3: "Calculator"
   - Tab 4: "Timer app"
   - Tab 5: "Weather widget"
3. **Expected Results**:
   - All apps process independently
   - No queue blocking
   - All users receive responses within reasonable time

### Test 8: Code Versioning (Local/Prod)

**Objective**: Verify version history and preview functionality

**Steps**:

1. Create an app: "Simple counter"
2. After initial response, send: "Make the buttons bigger and change color to
   blue"
3. Send another: "Add a reset button"
4. **Expected Results**:
   - Each agent response with code creates a new version
   - MiniPreview shows version number (v1, v2, v3)
   - Clicking "Version 1" opens modal with historical preview
   - Latest version is marked as "(latest)"

## Common Issues & Debugging

### Issue: Agent Not Responding

**Symptoms**:

- User message appears but no agent response
- "Agent Working" badge never appears or stays indefinitely

**Debug Steps**:

1. Check agent poll is running:
   ```bash
   ps aux | grep "agent:poll"
   ```

2. Check Redis queue has messages:
   ```bash
   yarn agent:poll --stats
   ```

3. Check agent logs for errors:
   ```bash
   # Local
   tail -f logs/agent-poll.log

   # If running in terminal, check stdout
   ```

4. Verify MCP config is valid:
   ```bash
   # Agent creates temp config in /tmp/claude-mcp-*
   ls -la /tmp/claude-mcp-*
   cat /tmp/claude-mcp-*/mcp-config.json
   ```

5. Test Claude CLI manually:
   ```bash
   echo "Create a hello world React app" | claude --print
   ```

### Issue: Preview Not Loading

**Symptoms**:

- Chat works but iframe shows blank/error

**Debug Steps**:

1. Check codespace URL directly:
   ```
   https://testing.spike.land/live/{codespace-id}/
   ```

2. Check backend worker logs (Cloudflare dashboard → testing.spike.land → Logs)

3. Verify transpilation succeeded:
   ```bash
   curl https://testing.spike.land/live/{codespace-id}/status
   ```

### Issue: SSE Connection Drops

**Symptoms**:

- Real-time updates stop working
- Need to refresh page to see new messages

**Debug Steps**:

1. Check browser DevTools → Network → EventSource status
2. Verify API endpoint is reachable:
   ```bash
   curl http://localhost:3000/api/apps/{app-id}/messages/stream
   ```

3. Check server logs for SSE errors

### Issue: Images Not Uploading

**Symptoms**:

- Image attachment button disabled or images don't preview

**Debug Steps**:

1. Check file size (max 5MB per image, 5 images max)
2. Verify S3/storage credentials configured
3. Check network tab for failed upload requests

## Performance Benchmarks

### Expected Timings (Local)

- App creation: < 2 seconds
- Agent response (simple app): 10-30 seconds
- Agent response (complex app): 30-60 seconds
- Preview load: < 3 seconds
- SSE connection: < 1 second

### Expected Timings (Production)

- App creation: < 3 seconds
- Agent response (simple app): 15-45 seconds (depends on queue)
- Agent response (complex app): 45-120 seconds
- Preview load: < 5 seconds
- SSE connection: < 2 seconds

## Test Coverage Checklist

- [ ] Local: Simple counter app
- [ ] Local: Calculator app
- [ ] Local: Todo list app
- [ ] Local: Data dashboard app
- [ ] Local: Image reference app
- [ ] Production: Simple hello world
- [ ] Production: Multi-user concurrent (3+ apps)
- [ ] Production: Code versioning (3+ iterations)
- [ ] Error handling: Invalid codespace name
- [ ] Error handling: Network timeout
- [ ] Error handling: Agent crash recovery
- [ ] Mobile responsive: Test on phone/tablet
- [ ] Cross-browser: Chrome, Firefox, Safari

## Success Criteria

✅ **Local Testing Passed** if:

- All 5 local test cases complete successfully
- Agent poll processes messages within 60 seconds
- Preview iframes load and are functional
- SSE updates work in real-time

✅ **Production Testing Passed** if:

- Smoke test succeeds on https://spike.land/my-apps
- Multi-user test handles 5 concurrent apps
- Code versioning works correctly
- Agent responses within 120 seconds

## Reporting Issues

When reporting issues, include:

1. Environment (local/production)
2. Codespace ID
3. Timestamp of issue
4. Browser console logs
5. Network tab screenshot
6. Agent poll logs (if accessible)

Create GitHub issue with label `my-apps` and assign to @zerdos.

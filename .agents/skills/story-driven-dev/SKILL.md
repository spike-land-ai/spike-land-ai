---
name: story-driven-dev
description: "Translate ideas into user stories, then implement each story as a testable MCP tool with unit tests. Use when: (1) building a new feature from an idea or requirement, (2) creating MCP tools from user stories, (3) writing MCP server tests, (4) replacing flaky E2E tests with unit-tested MCP tools, (5) story-driven development, (6) exposing business logic as MCP tools. Triggers: 'new feature', 'user story', 'MCP from idea', 'test MCP tool', 'create MCP server from requirements', 'story-driven', 'replace E2E with unit tests'."
---

# Story-Driven Development

Translate an idea into user stories, implement each as an MCP tool, test at unit
speed, then render UI as a thin layer. The MCP tools become the specification
layer — they define what the app does before any UI exists.

**The chain:** Idea → User Stories → MCP Tools + Unit Tests → Agent Verification
→ UI

## Phase 1: Discover

Turn the user's idea into structured user stories. See
[references/user-stories.md](references/user-stories.md) for format and
examples.

1. Ask clarifying questions about **who** (role), **what** (action), **why**
   (benefit)
2. Write stories: "As a [role], I want [action], so that [benefit]"
3. Define acceptance criteria as testable conditions for each story
4. Group stories into categories (these become MCP tool categories)
5. Map each story to a tool name using `verb_noun` convention
6. **Present stories to user for approval before proceeding**

## Phase 2: Specify

Translate each approved user story into an MCP tool. See
[references/tool-pattern.md](references/tool-pattern.md) for the full template.

For each story, define three things (the "Three Players"):

| Player      | What it constrains                  | Example                  |
| ----------- | ----------------------------------- | ------------------------ |
| **Name**    | What the tool does (and doesn't do) | `update_user_email`      |
| **Schema**  | What inputs are valid               | `z.string().email()`     |
| **Handler** | What behavior is guaranteed         | Returns `CallToolResult` |

Each constrains the other two. A well-named tool with a tight schema almost
writes its own handler.

Quick reference for the tool skeleton:

```typescript
registry.register({
  name: "verb_noun",
  description: "User story in plain language",
  category: "category-name",
  tier: "free",
  inputSchema: MySchema.shape, // .shape, not the schema itself
  handler: async (args): Promise<CallToolResult> => {
    // Business logic
    return { content: [{ type: "text", text: "..." }] };
  },
});
```

## Phase 3: Verify

Write unit tests for each MCP tool. See
[references/test-pattern.md](references/test-pattern.md) for the full template.

Test structure per tool:

1. **Registration** — correct number of tools registered, correct names
2. **Happy path** — valid input produces expected output
3. **Error cases** — invalid input, missing auth, DB failures →
   `{ isError: true }`
4. **Edge cases** — quota limits, already-deleted items, concurrent access

Run tests: `yarn vitest run path/to/tools/my-tool.test.ts`

These tests run in milliseconds. They never flake. They test the same business
logic that E2E tests would, without a browser.

## Phase 4: Agent Test

The agent exercises the MCP tools directly as integration testing. See
[references/agent-testing.md](references/agent-testing.md) for the approach.

Since MCP is the agent's native interface, it can:

- Call tools in sequence to simulate real user flows
- Verify responses make sense and chain correctly
- Catch issues unit tests miss: multi-tool flows, real data shapes, auth context
- Document unexpected behaviors, suggest fixes, re-run after fixes

## Phase 5: Render

Build UI as a thin rendering layer on top of the already-tested business logic.

- UI components call the **same service functions** the MCP handlers call
- E2E tests cover only visual/rendering concerns (layout, animations, hydration)
- The MCP tools already proved the business logic works
- Keep Playwright tests for: visual regressions, browser-specific behavior,
  CORS/auth middleware

## Checklist

- [ ] User stories approved before implementation
- [ ] Each story maps to exactly one MCP tool
- [ ] Tool names are `verb_noun`, descriptions are plain language
- [ ] Zod schemas use `.describe()` on every field
- [ ] Handler returns `CallToolResult` (success and error paths)
- [ ] Unit tests cover happy path, errors, and edge cases
- [ ] Tests pass: `yarn vitest run`
- [ ] Category added to `CATEGORY_DESCRIPTIONS` in `tool-registry.ts`
- [ ] Registration function called in `mcp-server.ts`
- [ ] Agent tested the tools by calling them directly

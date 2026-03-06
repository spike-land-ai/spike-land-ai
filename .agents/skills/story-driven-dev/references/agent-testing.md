# Agent Testing Guide

After unit tests pass, the agent exercises MCP tools directly as integration
testing. Since MCP is the agent's native interface, it becomes the test runner
-- no browser needed.

## Why Agent Testing

Unit tests mock dependencies. Agent testing uses real (or staging)
infrastructure:

- Catches issues mocks hide: real data shapes, auth context, rate limits
- Tests multi-tool flows: create, list, verify, delete, verify gone
- Validates tool descriptions are clear enough for an agent to use correctly
- Finds missing error messages, confusing responses, broken flows

## How to Agent-Test

### 1. Single Tool Smoke Test

For each tool, call it with valid input and verify the response makes sense:

```
Call: create_thing({ name: "Test", description: "Agent test" })
Expect: Response contains "Thing Created" and an ID
```

```
Call: create_thing({ name: "", description: "" })
Expect: Validation error (not a crash)
```

### 2. Multi-Tool Flow Test

Chain tools to simulate a real user flow:

```
1. list_things({})
   -> Expect: "No things found" (clean slate)

2. create_thing({ name: "Alpha", description: "First thing" })
   -> Expect: "Thing Created", capture ID

3. list_things({})
   -> Expect: contains "Alpha"

4. delete_thing({ thing_id: captured_id })
   -> Expect: "Thing Deleted"

5. list_things({})
   -> Expect: "No things found" (back to clean slate)

6. delete_thing({ thing_id: captured_id })
   -> Expect: error "not found" (already deleted)
```

### 3. What to Look For

| Issue                      | Signal                                            |
| -------------------------- | ------------------------------------------------- |
| Missing fields in response | Agent can't extract needed data for next step     |
| Unclear error messages     | Agent doesn't know how to recover                 |
| Auth not scoped            | Tool returns other users' data                    |
| Missing idempotency        | Double-create causes crash instead of upsert      |
| Inconsistent naming        | `thing_id` in one tool, `thingId` in another      |
| Broken cross-references    | Tool description says "use X" but X doesn't exist |

### 4. Document and Fix

When the agent finds an issue:

1. Note the tool name, input, expected vs actual response
2. Determine if it's a handler bug, schema bug, or description bug
3. Fix the code
4. Re-run the unit tests to make sure nothing broke
5. Re-run the agent flow to verify the fix

## Mapping to User Stories

Each user story from Phase 1 becomes an agent test scenario:

| User Story                                    | Agent Test Scenario                                   |
| --------------------------------------------- | ----------------------------------------------------- |
| "User can store a secret"                     | Call `vault_store_secret`, verify "Secret Stored"     |
| "User can list secrets without seeing values" | Call `vault_list_secrets`, verify no plaintext values |
| "User can revoke a secret"                    | Store, list, revoke, list again, verify gone          |

The acceptance criteria from the user story are the assertions. The agent test
proves the entire flow works end-to-end through MCP, without touching a browser.

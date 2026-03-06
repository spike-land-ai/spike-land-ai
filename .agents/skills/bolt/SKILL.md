---
name: bolt
description: Orchestrate development work through MCP. Manages GitHub issues, Jules sessions, and PR lifecycle. Use /bolt to start orchestration, check status, or manage work items.
---

# Bolt: MCP-Native Agent Orchestrator

Bolt orchestrates development work through MCP, replacing the legacy Ralph
system.

## Commands

### /bolt status

Show current orchestrator status:

- Active tasks and their states
- GitHub Projects sync status
- Jules session status

Use the `bolt_status` MCP tool from spike-land gateway.

### /bolt plan

Pick highest-priority "Ready" items and create Jules sessions:

1. Call `github_list_issues` to get board items
2. For each item (up to WIP limit):
   - Call `jules_create_session` with task details
3. Track sessions in state

### /bolt check

Monitor active Jules sessions:

1. For each active task in state:
   - Call `jules_get_session` to check status
   - If COMPLETED: check for PR
   - If FAILED: log failure
   - If AWAITING_PLAN_APPROVAL: auto-approve via `jules_approve_plan`
2. Update state file

### /bolt merge

Process approved PRs:

1. For each task with PR_CREATED status:
   - Call `github_get_pr_status` to check CI and reviews
   - If CI green + approved: merge and close

### /bolt loop

Run all steps in sequence: plan → check → merge Repeat every 5 minutes
(configurable).

## State File

State is stored in `.Codex/bolt-state.json` (git-tracked).

## Error Handling

- If Jules is unavailable: skip plan step, continue check/merge
- Always update state after each step

## Human Override

Just type in the conversation to override any Bolt decision. Bolt will respect
manual changes and not revert them.

## Configuration

Configured via `.Codex/bolt-state.json`:

- `wipLimit`: Max concurrent Jules sessions (default: 3)
- `iterationInterval`: Minutes between loop iterations (default: 5)
- `autoMerge`: Auto-merge when CI green + approved (default: false)
- `autoApprove`: Auto-approve Jules plans (default: true)

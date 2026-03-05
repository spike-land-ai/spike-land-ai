# Jules Process Observations and Future Improvements

This document captures observations from running the Ralph Jules automation
system and identifies areas for improvement.

## Date: 2025-01-14

## Problem Statement

The Ralph automation was stuck in a deadlock state:

- 16+ sessions in PLANNING state but none progressing
- Queue fill blocked due to "Jules at capacity: 16/15 active sessions"
- Pipeline utilization at 0%
- No new work being processed

## Root Causes Identified

### 1. No Stuck Session Cleanup

The `findStuckSessions()` function existed in `validator.ts` but was only used
for reporting, not for taking action. Sessions could remain stuck in PLANNING
indefinitely, blocking capacity.

### 2. Capacity Calculation Counted All Non-Terminal Sessions

All non-terminal sessions (PLANNING, AWAITING_PLAN_APPROVAL, IN_PROGRESS, etc.)
counted against the 15-session Jules limit, even if they were stuck and not
progressing.

### 3. CLI Fallback Lacks Accurate Timestamps

When MCP API is unavailable, the CLI fallback sets `createdAt` to the current
time for all sessions, making it impossible to detect genuinely stuck sessions
based on age.

## Fixes Implemented

### 1. Added Step 1.5: Handle Stuck Sessions

New step in `iteration.ts` that:

- Detects stuck state pattern: many PLANNING sessions with 0 progressing
- Marks excess sessions as DEAD when capacity is over limit
- Returns set of dead session IDs for use in capacity calculation

### 2. Updated Capacity Calculation

Modified `step4_fillQueue` to:

- Exclude sessions marked DEAD from capacity count
- Use "effective active" count instead of raw active count
- Log when sessions are excluded from capacity

### 3. Added Diagnostic Logging

When at capacity, the script now shows:

- How many sessions marked DEAD were excluded
- Effective active count vs limit
- Breakdown of which statuses are consuming capacity

## Observations from Testing (10+ iterations)

### What's Working

1. **Stuck detection is functional**: Correctly identifies when PLANNING
   sessions aren't progressing
2. **Capacity exclusion works**: Dead sessions are excluded, allowing new work
   to proceed
3. **New sessions created**: Queue fill now creates sessions when capacity is
   available
4. **Logging is clear**: Easy to understand what's happening at each step

### Issues Discovered

1. **All PLANNING sessions stay stuck**: Every new session goes to PLANNING and
   never transitions to AWAITING_PLAN_APPROVAL or IN_PROGRESS. This suggests
   Jules itself may not be processing these sessions.

2. **Duplicate session creation**: Since task state isn't persisted between
   iterations, the script keeps trying to create sessions for the same issue
   (#701). The existing session check compares against `result.updatedTasks`
   which starts empty each iteration.

3. **Growing dead session count**: Each iteration marks more sessions as DEAD
   (2→3→4→5→6→7→8), but Jules keeps accepting new sessions that also get stuck.

4. **MCP consistently unavailable**: Every iteration shows "MCP unavailable,
   falling back to Jules CLI..." which limits functionality:
   - No accurate timestamps for stuck detection by age
   - Can't approve plans via API
   - Can't send messages to sessions

## Recommendations for Future Improvements

### High Priority

1. **Fix MCP Connection**
   - Investigate why MCP is unavailable
   - Ensure SPIKE_LAND_API_KEY is set correctly
   - Consider adding retry logic with exponential backoff

2. **Persist Task State Between Iterations**
   - Save task entries to a JSON file or the registry markdown
   - Load existing tasks at start of each iteration
   - Prevents duplicate session creation for same issues

3. **Investigate Jules Session Processing**
   - Why aren't PLANNING sessions transitioning?
   - Check Jules API/CLI for errors
   - Consider adding session health check

### Medium Priority

4. **Add Session Age Tracking**
   - Store first-seen timestamp for each session locally
   - Use this for accurate stuck detection even with CLI fallback
   - Clean up entries for sessions that complete

5. **Rate Limit Session Creation**
   - Don't create new sessions if recent sessions aren't progressing
   - Add cooldown if too many sessions stuck
   - Consider backoff when stuck state detected

6. **Improve Deduplication**
   - Check Jules API for existing sessions before creating
   - Track which issues have active sessions across iterations

### Low Priority

7. **Add Alerting**
   - Notify when stuck state detected for extended period
   - Alert when capacity consistently at limit
   - Escalate if no progress after N iterations

8. **Metrics Dashboard**
   - Track session lifecycle times
   - Monitor stuck rate over time
   - Visualize throughput and bottlenecks

## Configuration Recommendations

Current effective settings based on observations:

| Setting             | Current        | Recommended            |
| ------------------- | -------------- | ---------------------- |
| JULES_SESSION_LIMIT | 15             | 15 (correct)           |
| STUCK_WARNING_HOURS | 1              | 0.5 (faster detection) |
| STUCK_DEAD_HOURS    | 2              | 1 (faster cleanup)     |
| Capacity buffer     | LIMIT - 1 (14) | LIMIT - 2 (13)         |

## Files Modified

- `scripts/ralph/iteration.ts` - Added Step 1.5, updated capacity logic
- `scripts/ralph/validator.ts` - Already exports `findStuckSessions()`

## Testing Commands

```bash
# Single iteration
yarn jules:process

# Continuous monitoring
yarn jules:process:watch

# Dry run (no changes)
yarn jules:process:dry
```

## Conclusion

The capacity deadlock has been resolved by implementing stuck session detection
and exclusion from capacity calculation. However, there are deeper issues with
Jules sessions not progressing that need investigation. The MCP connection also
needs to be restored for full functionality.

The immediate fix allows the automation to continue creating new sessions, but
the underlying cause of sessions getting stuck in PLANNING should be addressed
for long-term stability.

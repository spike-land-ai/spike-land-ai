---
slug: "orchestrator"
name: "Agent Orchestrator"
description: "Manage complex multi-step tasks by delegating sub-tasks to specialized agents and merging the results."
emoji: "🎼"
status: "live"
sort_order: 3
tools:
  - "orchestrator_create_plan"
  - "orchestrator_dispatch"
  - "orchestrator_status"
  - "orchestrator_submit_result"
  - "orchestrator_merge"
graph:
  orchestrator_create_plan:
    inputs: {}
    outputs:
      plan_id: "string"
    always_available: true
  orchestrator_dispatch:
    inputs:
      plan_id: "from:orchestrator_create_plan.plan_id"
    outputs:
      task_id: "string"
    always_available: false
  orchestrator_status:
    inputs:
      plan_id: "from:orchestrator_create_plan.plan_id"
    outputs: {}
    always_available: false
  orchestrator_submit_result:
    inputs:
      plan_id: "from:orchestrator_create_plan.plan_id"
      task_id: "from:orchestrator_dispatch.task_id"
    outputs: {}
    always_available: false
  orchestrator_merge:
    inputs:
      plan_id: "from:orchestrator_create_plan.plan_id"
    outputs: {}
    always_available: false
---

# Agent Orchestrator

The orchestrator demonstrates how to manage complex workflows by breaking them down into a Directed Acyclic Graph (DAG) of tasks.

## 1. Create a Plan

Start by creating an execution plan with a set of dependencies.

<ToolRun name="orchestrator_create_plan" />

## 2. Dispatch Task

Once a plan is created, you can dispatch tasks to workers.

<ToolRun name="orchestrator_dispatch" />

## 3. Check Status

Monitor the progress of your overall plan.

<ToolRun name="orchestrator_status" />

## 4. Submit Result

Workers submit their results back to the orchestrator using the task ID.

<ToolRun name="orchestrator_submit_result" />

## 5. Merge

When all tasks are complete, merge the results into a final output.

<ToolRun name="orchestrator_merge" />

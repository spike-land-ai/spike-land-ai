---
slug: "crdt-lab"
name: "CRDT Lab"
description: "Interactive lab for Conflict-free Replicated Data Types (CRDTs). Create a set, add items, and sync between peers."
emoji: "🔄"
status: "live"
sort_order: 1
tools:
  - "crdt_create_set"
  - "crdt_update"
  - "crdt_sync_pair"
  - "crdt_sync_all"
  - "crdt_inspect"
  - "crdt_check_convergence"
  - "crdt_compare_with_consensus"
graph:
  crdt_create_set:
    inputs: {}
    outputs:
      set_id: "string"
    always_available: true
  crdt_update:
    inputs:
      set_id: "from:crdt_create_set.set_id"
    outputs: {}
    always_available: false
  crdt_sync_pair:
    inputs: {}
    outputs: {}
    always_available: true
  crdt_sync_all:
    inputs: {}
    outputs: {}
    always_available: true
  crdt_inspect:
    inputs:
      set_id: "from:crdt_create_set.set_id"
    outputs: {}
    always_available: false
  crdt_check_convergence:
    inputs: {}
    outputs: {}
    always_available: true
  crdt_compare_with_consensus:
    inputs:
      set_id: "from:crdt_create_set.set_id"
    outputs: {}
    always_available: false
---

# CRDT Lab

Welcome to the **Conflict-free Replicated Data Types** interactive lab. This workflow allows you to understand how CRDT sets resolve concurrent edits without conflicts.

## 1. Create a CRDT Set

First, you need to create a new CRDT Set. This initializes an empty set with a unique ID that we'll use for all subsequent operations.

<ToolRun name="crdt_create_set" />

## 2. Update the Set

Now that we have a `set_id`, let's add some items to it. Because we're simulating a distributed system, updates might not be immediately visible to all peers until they synchronize.

<ToolRun name="crdt_update" />

## 3. Inspect State

You can inspect the state of your set at any point to see what items are currently visible.

<ToolRun name="crdt_inspect" />

## 4. Synchronization

In a distributed network, nodes eventually sync their states. You can force a synchronization event here.

<ToolRun name="crdt_sync_all" />

## 5. Convergence Verification

CRDTs guarantee strong eventual consistency. Check if all nodes have reached the same state.

<ToolRun name="crdt_check_convergence" />

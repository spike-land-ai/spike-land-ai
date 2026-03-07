---
slug: "app-builder"
name: "App Builder"
description: "Use MCP tools to create and manage other MCP apps. Meta-tooling at its finest."
emoji: "🏗️"
status: "live"
sort_order: 4
tools:
  - "apps_create"
  - "apps_list"
  - "apps_get"
  - "apps_chat"
  - "apps_versions"
graph:
  apps_list:
    inputs: {}
    outputs: {}
    always_available: true
  apps_create:
    inputs: {}
    outputs:
      app_id: "string"
    always_available: true
  apps_get:
    inputs:
      app_id: "from:apps_create.app_id"
    outputs: {}
    always_available: false
  apps_chat:
    inputs:
      app_id: "from:apps_create.app_id"
    outputs: {}
    always_available: false
  apps_versions:
    inputs:
      app_id: "from:apps_create.app_id"
    outputs: {}
    always_available: false
---

# App Builder

The App Builder is an app that manages apps. This allows the AI agent to recursively create and refine workflows.

## 1. List Apps

See what apps are currently available.

<ToolRun name="apps_list" />

## 2. Create App

Generate a new application from a prompt.

<ToolRun name="apps_create" />

## 3. Get App Details

Fetch the full configuration and current state of a specific app.

<ToolRun name="apps_get" />

## 4. App Chat

Have a conversation focused purely on modifying and improving an app's codebase.

<ToolRun name="apps_chat" />

## 5. Versions

View the deployment history and version logs for an app.

<ToolRun name="apps_versions" />

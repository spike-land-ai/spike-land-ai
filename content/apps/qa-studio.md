---
slug: "qa-studio"
name: "QA Studio"
description: "Control headless browsers directly. Navigate web apps, extract semantic structure, take screenshots, and automate UI interactions."
emoji: "🔬"
status: "live"
sort_order: 5
tools:
  - "web_navigate"
  - "web_read"
  - "web_click"
  - "web_type"
  - "web_screenshot"
graph:
  web_navigate:
    inputs: {}
    outputs:
      page_url: "string"
    always_available: true
  web_read:
    inputs: {}
    outputs: {}
    always_available: true
  web_click:
    inputs: {}
    outputs: {}
    always_available: true
  web_type:
    inputs: {}
    outputs: {}
    always_available: true
  web_screenshot:
    inputs: {}
    outputs: {}
    always_available: true
---

# QA Studio

QA Studio provides full browser automation capabilities via Playwright and Cloudflare Browser Rendering. It allows you to programmatically navigate websites, interact with complex UIs, and extract data.

## 1. Navigate

Open a new browser tab or navigate the current one to a specific URL.

<ToolRun name="web_navigate" />

## 2. Read Semantic State

Extract the accessibility tree of the current page, returning a condensed, semantic representation of the UI that is optimized for analysis.

<ToolRun name="web_read" />

## 3. Interact

Click elements, type into inputs, and navigate complex interfaces using accessibility references.

<ToolRun name="web_click" />
<ToolRun name="web_type" />

## 4. Visual Verification

Capture a visual snapshot of the current browser state for debugging or verification.

<ToolRun name="web_screenshot" />

## Connecting to Local Runtime

To use QA Studio locally with Playwright, start the local MCP server:

```bash
npx @spike-land-ai/qa-studio --http --visible
```

Then visit the [QA Studio Dashboard](/apps/qa-studio) to connect and start automating.

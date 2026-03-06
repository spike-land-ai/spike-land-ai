---
name: spike-land-dashboard
description: Create and use parameterized React dashboard apps on spike.land. Use when an agent needs to (1) create a live dashboard/visualization, (2) pass structured data to an app via URL params, (3) build an interactive tool that receives input from its URL, (4) create a shareable data view for users.
---

# Spike Land Dashboard

Create live React apps on testing.spike.land that accept structured data via URL
search parameters.

## How It Works

Apps run inside iframes at `https://testing.spike.land/live/{codespaceId}/`.
Query params on that URL flow through to `window.location.search` inside the
component. Components read params on mount, use them as initial state, and sync
changes back to the URL.

## Component Template

```tsx
// URL Params: title (string), items (JSON array), view (string: "grid"|"list")
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";

const DEFAULT_ITEMS = [{ name: "Example", value: 42 }];

export default function Dashboard({ width, height }) {
  const params = new URLSearchParams(window.location.search);

  // Parse params with safe fallbacks
  const initialTitle = params.get("title") ?? "Dashboard";
  const initialItems = (() => {
    try {
      return JSON.parse(params.get("items") || "null");
    } catch {
      return null;
    }
  })();
  const initialView = params.get("view") ?? "grid";

  const [title, setTitle] = useState(initialTitle);
  const [items, setItems] = useState(initialItems ?? DEFAULT_ITEMS);
  const [view, setView] = useState(initialView);

  // Sync state back to URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("title", title);
    url.searchParams.set("items", JSON.stringify(items));
    url.searchParams.set("view", view);
    window.history.replaceState({}, "", url);
  }, [title, items, view]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{/* render items */}</CardContent>
    </Card>
  );
}
```

## Creating Apps via MCP

Use the `codespace_update` tool to push code:

```
codespace_update({
  codespace_id: "my-dashboard",
  code: "<component code here>"
})
```

Then link it as a named app:

```
codespace_link_app({
  codespace_id: "my-dashboard",
  app_name: "Sales Dashboard",
  app_description: "Real-time sales metrics"
})
```

## Constructing URLs with Params

Build the iframe URL with encoded params:

```
const baseUrl = "https://testing.spike.land/live/my-dashboard/";
const params = new URLSearchParams({
  title: "Q4 Sales",
  items: JSON.stringify([{ region: "US", revenue: 150000 }]),
  view: "grid"
});
const url = `${baseUrl}?${params}`;
```

## Conventions

| Rule           | Detail                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| Param names    | Short, lowercase: `items`, `title`, `view`, `config`                                      |
| Reserved names | `room` is used by the runtime — never use it                                              |
| Complex values | JSON-encode with `JSON.stringify`, parse with `try/catch`                                 |
| Simple values  | Pass as plain strings                                                                     |
| URL length     | Keep under ~2000 chars; for large payloads, consider pasting JSON into the app UI instead |
| Defaults       | Always provide sensible fallback values when params are missing                           |
| Error handling | Never crash on malformed params — fall back to defaults                                   |

# App Store Overview

## What The Store Is

The spike.land app store is the public distribution layer for MCP-native apps.
An app can be discovered visually, inspected programmatically, installed into a
workspace, and called by agents through the same underlying tool runtime.

There are two complementary discovery surfaces:

1. a public app catalog backed by `mcp_apps`
2. a broader tool catalog built from public MCP definitions

That split is intentional. Some users want complete apps. Others want the raw
tool surface to compose their own flows.

---

## Discovery Model

### Search And Browse

The store supports:

- keyword search across names, taglines, descriptions, and tags
- category browsing
- featured listings
- new listings
- app detail lookup by slug

At the MCP layer this maps to:

- `store_search`
- `store_browse_category`
- `store_featured_apps`
- `store_new_apps`
- `store_app_detail`

### Personalized Discovery

The catalog is not purely editorial.

Current personalization signals include:

- install history
- tag overlap with a current app
- persona-driven recommended app slugs

That is why the platform talks about dynamic and AI-curated categories. The
store can keep changing how it groups and recommends apps without requiring each
app to ship a new protocol surface.

---

## Ratings, Reviews, And Wishlists

The store supports social proof and intent capture through:

- star ratings and review bodies
- wishlists
- install counts
- personalized recommendations

Representative tools:

- `store_app_rate`
- `store_app_reviews`
- `store_wishlist_add`
- `store_wishlist_remove`
- `store_wishlist_get`
- `store_recommendations_get`
- `store_app_personalized`
- `store_stats`

This gives developers a usable marketplace loop instead of a flat directory.

---

## Install Flow

The install path is intentionally simple:

1. discover an app
2. inspect its details and tool count
3. install it into the current user/workspace context
4. verify install state or uninstall later

Representative tools:

- `store_app_install`
- `store_app_uninstall`
- `store_app_install_status`
- `store_app_install_list`
- `store_app_install_count`

Install counts are public-facing metadata. The install action itself is an
authenticated operation.

---

## Skill Store

The app store also has a parallel skill-distribution surface.

This matters because spike.land is not only distributing end-user apps. It is
also distributing building blocks for agent workflows.

Representative tools:

- `store_skills_list`
- `store_skills_get`
- `store_skills_install`
- `store_skills_my_installs`

In practice this means the app store can distribute both full apps and reusable
agent capabilities.

---

## App Lifecycle

### Current Platform States

The repo already models publication gates:

- `mcp_apps.status` defaults to `draft`
- public app listings are filtered to `live`
- marketplace-style tool records use `draft` and `published`

### Operating Lifecycle

The intended app-store lifecycle is:

`submit -> validate -> review -> publish -> install -> iterate`

What each stage means:

- `submit`: provide tool bundle, metadata, and app content
- `validate`: schema, auth, category, and runtime checks
- `review`: automated checks plus human approval where needed
- `publish`: promote from draft to public visibility
- `install`: users add it through the store
- `iterate`: deploy variants, monitor quality, and improve

The code already enforces the publication-state side of this lifecycle. The
human and AI review process is the operational layer on top.

---

## A/B And Quality Loop

The store is not just about discovery. It also includes deployment-quality
tooling.

Store A/B tools support:

- deployment creation
- variant creation
- consistent visitor assignment
- impression tracking
- error tracking
- result reporting
- winner declaration

That enables the quality loop:

`publish -> observe -> test variants -> promote safer/better variant`

Read more: [AB_TESTING_BUG_DETECTION.md](./AB_TESTING_BUG_DETECTION.md)

---

## App Metadata Shape

Public app listings expose the fields that matter for discovery:

- `slug`
- `name`
- `description`
- `emoji`
- `tool_count`
- `sort_order`

App detail responses can also include:

- serialized tool definitions
- graph metadata
- markdown content
- publication status

This is what makes the store usable by both humans and agents: metadata is
available as structured JSON, not trapped inside HTML.

---

## Human Flow vs Agent Flow

### Human Flow

1. Visit the store UI
2. Search or browse
3. Read detail page
4. Install, review, or wishlist

### Agent Flow

1. Query store metadata or public tools
2. Inspect a specific app or category
3. Install or call related tools
4. Feed usage outcomes back into ranking or experimentation

The same store supports both because every meaningful action has a tool surface.

---

## Why The Store Matters

The store turns spike.land from a hosted MCP endpoint into a platform:

- developers get distribution
- users get discovery and trust signals
- agents get callable software
- the platform gets usage data that improves recommendations and experimentation

That is the foundation for the marketplace model and the app-store flywheel.

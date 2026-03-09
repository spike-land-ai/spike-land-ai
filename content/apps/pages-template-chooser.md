---
slug: "pages-template-chooser"
name: "Pages Template Chooser"
description: "A native-feeling macOS template gallery for Pages with premium upsell surfaces, dense category navigation, and polished selection states."
emoji: "📄"
category: "Media & Creative"
tags:
  - "macos"
  - "pages"
  - "templates"
  - "design"
  - "app-store"
tagline: "App Store quality template picking for Pages on macOS."
pricing: "free"
is_featured: true
is_new: true
status: "live"
sort_order: 5
tools: []
graph: {}
---

# Pages Template Chooser

An App Store quality template picker for Pages on macOS. The goal is not a generic file-open dialog. It should feel like a first-party creation surface with a calm sidebar, premium merchandising, and a dense but elegant preview grid.

## Product Intent

- make starting a document feel visual and low-friction
- organize a large template catalog without overwhelming the user
- create a clear premium upsell surface for Apple Creator Studio
- preserve familiar macOS interaction patterns: native title bar, sticky footer actions, scrollable content, strong keyboard behavior

## Core Surface

### Window shell

- native macOS title bar with traffic-light controls
- two-pane layout
- translucent left sidebar using macOS material treatment
- white right content surface with scrollable template grid
- sticky footer with `Cancel` and `Create`

### Sidebar categories

The left pane should present the full catalog:

- All Templates
- Premium
- Basic
- Reports
- Education
- Certificates
- Organisers
- Newsletters
- Brochures
- Business
- Books
- Cards
- Posters & Flyers
- Letters
- Curricula Vitae
- Stationery
- Miscellaneous

The active category needs a clear rounded highlight, bold label, and monochrome line icon. The list should be dense, navigable by keyboard, and comfortable on smaller MacBook screens.

### Main grid behavior

- large category title at the top of the page
- optional subheaders when multiple families appear in one view
- prominent Creator Studio promo banner under `All Templates`
- thumbnail-first template cards with centered titles
- premium badge in the top-right corner
- strong selected state: thick orange border plus inverted title treatment

## Initial Template Catalog

The first release should ship with the complete category inventory from the PRD:

- Basic foundations such as Blank, Blank Layout, Blank Landscape, Blank Black, and Note Taking
- structured report and proposal templates for academic, scientific, community, startup, travel, wedding, and industrial use cases
- education planners, schedules, notes, lesson plans, and classroom organisers
- a broad certificate pack from playful classroom awards to formal traditional certificates
- organiser, newsletter, brochure, and business template families
- a small miscellaneous bucket for cross-listed brochure and invoice layouts

## Quality Bar

- App Store presentation quality from day one
- crisp thumbnails that still read well at small sizes
- native-feeling spacing, hover states, and selection feedback
- zero background scrolling while modal or chooser overlays are open
- accessibility support for keyboard navigation, VoiceOver labels, and visible focus rings

## Recommended Build Sequence

1. create the template-domain data model and category registry
2. build the split-view shell with sticky footer and scroll-safe behavior
3. implement the category sidebar and template selection state
4. add the Apple Creator Studio banner and premium badges
5. fill the catalog with the full first-party template set
6. add search, recents, and last-used templates after the base chooser is stable

## Next Iteration

- search and smart filtering
- recent templates and pinned favorites
- richer preview zoom
- localized copy and category labels
- a real import pipeline for premium template packs

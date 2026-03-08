---
name: rubik
description: spike.land web design system — typography, components, styling, UI patterns, embedded preview surfaces, semantic-token theming, and kinetic type effects. Use for any spike.land design, UI, styling, font, layout, theme, dashboard, preview iframe, Monaco-adjacent demo, or typography work. Reach for this skill whenever a spike.land screen feels generic, too spacious, visually inconsistent, or weak in light/dark mode.
---

# Rubik: spike.land Design System

Named after Erno Rubik — geometric precision meets expressive motion.

## Design Identity

spike.land's visual DNA: **geometric, slightly rounded, futuristic**. The site
feels like a developer tool that has a personality — clean and functional, but
never boring.

## Working Mode

Start by identifying the surface you are designing. Rubik should produce
different density, type scale, and composition for a landing page than for an
embedded app preview.

| Surface | Use when | Default posture | Common failure mode |
|---------|----------|-----------------|---------------------|
| **Marketing / hero** | Homepages, launches, storytelling sections | Bigger type, more atmosphere, fewer UI controls | Looks like a generic SaaS gradient |
| **Product / dashboard** | Logged-in tools, settings, analytics, MCP control surfaces | Denser layout, clearer information hierarchy, stronger panel structure | Becomes flat and boxy |
| **Embedded / preview** | Iframes, live demos, Monaco examples, generated sample apps | Compact, viewport-aware, compositional, no wasted space | Ships a squeezed landing page instead of a product surface |

For embedded previews, prefer **density over sprawl**. A preview should feel
like a complete instrument panel, not a full marketing page crammed into a
smaller box.

### Typography Stack

| Role | Font | Weight Range | Usage |
|------|------|-------------|-------|
| **Sans (primary)** | Rubik (variable) | 300–900 | Body text, UI, headings |
| **Display** | Rubik (variable, weight 700–900) | 700–900 | Hero headings, landing page |
| **Mono** | JetBrains Mono | 400–700 | Code blocks, terminal |
| **Effect: Glitch** | Rubik Glitch | 400 | Glitch text effects (Google Fonts) |
| **Effect: Wet Paint** | Rubik Wet Paint | 400 | Melting/dripping effects (Google Fonts) |
| **Effect: Burned** | Rubik Burned | 400 | Distressed text effects (Google Fonts) |
| **Effect: Mono One** | Rubik Mono One | 400 | Bold mono display headers (Google Fonts) |

### Font Loading

Primary Rubik is loaded via Google Fonts in `index.html` with `font-display: swap`.
Display variants (Glitch, Wet Paint, Burned, Mono One) load on-demand via Google Fonts
only when their respective components mount.

### CSS Configuration

In `packages/spike-app/app.css`:
```css
@theme {
  --font-sans: "Rubik", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Rubik", ui-sans-serif, system-ui, sans-serif;
}
```

Use Tailwind classes: `font-sans` (Rubik) everywhere. For display headings use
`font-display` with heavier weights (700–900).

### Type Scale

| Element | Size | Weight | Tracking |
|---------|------|--------|----------|
| Hero h1 | `text-5xl sm:text-7xl` | 700–800 | `tracking-tight` |
| Page h1 | `text-3xl sm:text-5xl` | 800 | `tracking-tight` |
| Section h2 | `text-2xl sm:text-3xl` | 700 | `tracking-tight` |
| Subheading h3 | `text-xl` | 600 | default |
| Body | `text-base` | 400 | default |
| Caption | `text-sm` | 400 | `tracking-wide` |
| Overline | `text-xs` | 600 | `tracking-widest uppercase` |

## Color System

All colors use semantic CSS variables. **Never hardcode colors.**

- `text-foreground` / `text-muted-foreground` — text
- `bg-background` / `bg-muted` / `bg-card` — backgrounds
- `border-border` — borders
- `text-primary` — links, accents
- Dark mode handled by `.dark` class toggling CSS variables — no `dark:` prefix needed

See `references/tokens.md` for full token map.

### Token Propagation

If the UI renders inside an iframe, generated preview shell, or any isolated
runtime, do not assume the host app's CSS variables exist there.

- Inject the semantic tokens the surface needs into the preview shell
- Mirror typography tokens too: `--font-sans`, `--font-display`, `--font-mono`
- Recompute light and dark colors independently; a color that works on dark can
  wash out on a pale background
- Prefer mixing accent colors with foreground on light surfaces to keep contrast

When a task involves Monaco, code previews, or generated sample apps, make the
preview itself theme-aware, not just the host UI around it.

## Layout Heuristics

### Embedded Preview Rules

Use these defaults for live demos, generated TSX samples, or product previews:

- Assume the default safe viewport is roughly `900-1400px` wide and `700-900px` tall
- Design so the first meaningful composition fits without scrolling unless the
  user explicitly wants a long page
- Keep to `2-4` primary panels
- Keep most explanatory copy to `1-2` sentences per block
- Prefer one strong focal panel over multiple giant cards competing at once
- Remove ornamental empty stages unless they communicate system state
- Make the narrowest likely state look intentional, not merely acceptable

If the surface is meant to fit in-frame, verify:

- `scrollHeight <= clientHeight`
- `scrollWidth <= clientWidth`
- light mode remains legible
- dark mode remains legible

### Density Ladder

Pick type and spacing based on containment, not habit.

| Context | H1 | Section title | Body | Card padding |
|--------|----|---------------|------|--------------|
| Hero / page top | `text-5xl sm:text-7xl` | `text-2xl sm:text-3xl` | `text-base` | `p-6` to `p-8` |
| Product surface | `text-3xl sm:text-5xl` | `text-xl sm:text-2xl` | `text-sm` to `text-base` | `p-4` to `p-6` |
| Embedded preview | `text-3xl sm:text-5xl`, bias smaller | `text-lg sm:text-2xl` | `text-xs` to `text-sm` | `p-3` to `p-5` |

When in doubt inside a preview, reduce vertical padding before reducing contrast.

## Kinetic Typography

spike.land blog posts use **expressive typography** — text that communicates
through size, weight, and motion. Components live in
`src/block-website/src/ui/components/typography/`.

### Available Components

| Component | MDX Tag | Effect |
|-----------|---------|--------|
| `Whisper` | `<whisper>` | Text shrinks + lightens — a visual whisper |
| `Crescendo` | `<crescendo>` | Text grows bolder word-by-word — building emphasis |
| `ScrollWeight` | `<scrollweight>` | Font weight shifts 300→700 as you scroll |
| `TypeReveal` | `<typereveal>` | Character-by-character reveal with weight animation |
| `GlitchText` | `<glitchtext>` | Rubik Glitch font with CSS glitch animation |

All registered in `COMPONENT_MAP` in `BlogPost.tsx` for MDX usage.

See `references/typography.md` for component implementation details.

### Variable Font Animation

Rubik's `wght` axis (300–900) is the key to kinetic effects:

```css
/* Animate weight smoothly */
.animate-weight {
  transition: font-variation-settings 0.3s ease;
  font-variation-settings: "wght" var(--font-weight, 400);
}
```

In Framer Motion:
```tsx
<motion.span
  style={{ fontVariationSettings: `"wght" ${weight}` }}
  animate={{ fontVariationSettings: `"wght" ${targetWeight}` }}
  transition={{ duration: 0.6, ease: "easeOut" }}
/>
```

## Component Patterns

### Cards
- `bg-card border border-border rounded-xl` base
- Optional `backdrop-blur-sm` for glass effect
- `hover:border-muted-foreground/30` for subtle hover

### Product Panels

For spike.land product surfaces, think in **stacked instruments** rather than
generic cards.

- Use one primary panel with the strongest story or interaction
- Support it with smaller panels that clarify state, commands, or metrics
- Let asymmetry carry hierarchy; not every panel must be the same size
- If a panel has no clear job, compress it or remove it

Useful panel roles:

- **Atlas**: selectable app/tool cards
- **Detail**: active item state, status, features, metrics
- **Command rail**: monospace or procedural steps
- **Signal strip**: small metrics or status tiles
- **Flow list**: 3-4 concise steps for the interaction model

### Embedded Sample Apps

When generating a sample app for a code editor or preview pane:

- Build a **real product-shaped slice**, not a toy hover card
- Show at least one meaningful interaction or state switch
- Reflect spike.land themes with semantic tokens, not one-off colors
- Keep the layout visually complete even before user interaction
- Avoid giant hero sections if the sample lives inside another app shell
- Make the first screen explain the product immediately

Good sample structures:

- two-column atlas + detail panel
- dashboard header + interactive card grid + command rail
- compact console with metrics, selected item, and procedural flow

### Buttons
- Primary: `bg-foreground text-background rounded-xl hover:opacity-90`
- Secondary: `bg-background border border-border text-foreground rounded-xl hover:bg-muted/50`

### Blog Prose
The `prose` classes in `BlogPost.tsx` apply Rubik via `font-sans`:
- `prose-headings:font-display prose-headings:font-bold`
- `prose-p:font-sans prose-p:leading-loose`

## Animation Guidelines

### Framer Motion Springs
```tsx
const SPRING_SNAPPY = { type: "spring", stiffness: 400, damping: 30 };
const SPRING_GENTLE = { type: "spring", stiffness: 200, damping: 25 };
const SPRING_BOUNCY = { type: "spring", stiffness: 300, damping: 15 };
```

### Scroll Animations
Use `useInViewProgress()` from `src/block-website/src/ui/interactive/useInViewProgress.ts`.
Returns `{ ref, progress }` where progress is 0→1 as element scrolls into view.

### CSS-first Rule
Prefer CSS transitions for simple hover/focus states. Use Framer Motion only for:
- Orchestrated sequences (staggered children)
- Scroll-driven animations
- Layout animations
- Complex spring physics

For embedded previews, animation should reinforce structure, not create noise.
Bias toward:

- slow ambient glows
- one scanning or sweep effect
- staggered reveals only when they do not delay comprehension

Avoid multiple competing decorative motions in small viewports.

## Design Review Checklist

Before calling a spike.land UI done, review it against this list:

- Does the screen match the surface type: hero, product, or embedded preview?
- Is the hierarchy obvious in three seconds?
- Are light and dark mode both intentionally tuned, not just mechanically inverted?
- Are semantic tokens used everywhere color matters?
- Does the typography feel like Rubik, not default web UI?
- Is there any panel that is mostly empty atmosphere instead of useful composition?
- If embedded, does it fit without awkward clipping or unnecessary scrolling?
- Does motion add meaning, or just movement?

## Prohibitions

- **No Inter, Roboto, Arial, Schibsted Grotesk** — Rubik is the identity font
- **No hardcoded colors** — semantic tokens only
- **No `dark:` prefix** — CSS variables handle themes
- **No generic layouts** — every section should feel intentional
- **No full landing pages inside small previews** — design for containment
- **No washed-out accent palettes in light mode** — increase contrast deliberately
- **No `any` type** — use `unknown` or proper types
- **No `@ts-ignore` / `eslint-disable`**

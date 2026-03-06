---
name: rubik
description: spike.land web design system — typography, components, styling, UI patterns, kinetic type effects. Use for any spike.land design, UI, styling, font, or typography work.
---

# Rubik: spike.land Design System

Named after Erno Rubik — geometric precision meets expressive motion.

## Design Identity

spike.land's visual DNA: **geometric, slightly rounded, futuristic**. The site
feels like a developer tool that has a personality — clean and functional, but
never boring.

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

## Prohibitions

- **No Inter, Roboto, Arial, Schibsted Grotesk** — Rubik is the identity font
- **No hardcoded colors** — semantic tokens only
- **No `dark:` prefix** — CSS variables handle themes
- **No generic layouts** — every section should feel intentional
- **No `any` type** — use `unknown` or proper types
- **No `@ts-ignore` / `eslint-disable`**

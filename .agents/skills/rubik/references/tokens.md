# Design Tokens Reference

## Font Configuration

### Tailwind v4 `@theme` block (in `packages/spike-app/app.css`)

```css
@theme {
  --font-sans: "Rubik", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Rubik", ui-sans-serif, system-ui, sans-serif;
}
```

### Google Fonts URL

Primary (in `index.html`):
```
Rubik:wght@300..900
```

Display variants (loaded on-demand by components):
- `Rubik+Glitch`
- `Rubik+Wet+Paint`
- `Rubik+Burned`
- `Rubik+Mono+One`

## Semantic Color Tokens

### Light Theme (`:root`)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#f9fafb` | Page background |
| `--fg` | `#111827` | Primary text |
| `--card-bg` | `#ffffff` | Card backgrounds |
| `--card-fg` | `#111827` | Card text |
| `--muted-bg` | `#f3f4f6` | Muted sections |
| `--muted-fg` | `#6b7280` | Secondary text |
| `--border-color` | `#e5e7eb` | Borders |
| `--primary-color` | `#2563eb` | Links, accents |
| `--primary-fg` | `#ffffff` | Text on primary |

### Dark Theme (`.dark`)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#09090b` | Page background |
| `--fg` | `#fafafa` | Primary text |
| `--card-bg` | `#18181b` | Card backgrounds |
| `--muted-bg` | `#27272a` | Muted sections |
| `--muted-fg` | `#a1a1aa` | Secondary text |
| `--border-color` | `#3f3f46` | Borders |
| `--primary-color` | `#3b82f6` | Links, accents |

### Tailwind Mappings

| Tailwind Class | CSS Variable |
|---------------|-------------|
| `bg-background` | `--color-background` → `--bg` |
| `text-foreground` | `--color-foreground` → `--fg` |
| `bg-card` | `--color-card` → `--card-bg` |
| `bg-muted` | `--color-muted` → `--muted-bg` |
| `text-muted-foreground` | `--color-muted-foreground` → `--muted-fg` |
| `border-border` | `--color-border` → `--border-color` |
| `text-primary` | `--color-primary` → `--primary-color` |

## Rubik Variable Font Axes

| Axis | Range | Usage |
|------|-------|-------|
| `wght` | 300–900 | Weight animation, emphasis |

### Weight Scale Mapping

| Tailwind | Value | Rubik Weight |
|----------|-------|-------------|
| `font-light` | 300 | Whisper, de-emphasis |
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | UI labels, nav items |
| `font-semibold` | 600 | Subheadings |
| `font-bold` | 700 | Headings, emphasis |
| `font-extrabold` | 800 | Display headings |
| `font-black` | 900 | Hero text, maximum impact |

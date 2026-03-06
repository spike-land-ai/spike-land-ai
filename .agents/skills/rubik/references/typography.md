# Kinetic Typography Components

All components live in `src/block-website/src/ui/components/typography/`.
They use Framer Motion + Rubik variable font (`wght` 300–900).

## Whisper

Text that gets progressively smaller and lighter — a visual whisper.

```tsx
// Usage in MDX: <whisper>this is barely audible</whisper>
// Each word renders at decreasing size and weight
```

Implementation: splits children into words, maps each word to decreasing
`fontSize` (1em → 0.7em) and `fontWeight` (400 → 300). Fades opacity
slightly. Animates on scroll entry via `useInViewProgress`.

## Crescendo

Text that builds from light to bold — growing emphasis.

```tsx
// Usage in MDX: <crescendo>and then it all clicked</crescendo>
// Each word gets progressively bolder and larger
```

Implementation: splits into words, maps to increasing `fontWeight`
(300 → 800) and slight size increase. Staggered fade-in on scroll entry.

## ScrollWeight

Wraps a block of text. Font weight shifts from 300→700 as user scrolls
through the section.

```tsx
// Usage in MDX: <scrollweight>This text gets heavier as you scroll</scrollweight>
```

Implementation: uses `useInViewProgress` to drive `fontVariationSettings`
interpolation. Progress 0→1 maps to weight 300→700.

## TypeReveal

Character-by-character reveal with weight animation. Each character starts
at weight 300 and animates to 500 as it appears.

```tsx
// Usage in MDX: <typereveal>Loading the future...</typereveal>
```

Implementation: splits into characters, uses staggered Framer Motion
animation. Each character starts `opacity: 0, fontWeight: 300` and
animates to `opacity: 1, fontWeight: 500`.

## GlitchText

Uses the Rubik Glitch display font with a CSS glitch animation overlay.

```tsx
// Usage in MDX: <glitchtext>SYSTEM ERROR</glitchtext>
```

Implementation: renders text in `font-family: "Rubik Glitch"` with a
CSS `@keyframes glitch` animation that applies random `clip-path` and
slight x-translate. Loads font on-demand via a `<link>` tag injection.

## Shared Patterns

### Word Splitting
```tsx
function splitWords(text: string) {
  return text.split(/\s+/).filter(Boolean);
}
```

### Character Splitting
```tsx
function splitChars(text: string) {
  return [...text];
}
```

### Font Weight Interpolation
```tsx
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Usage: lerp(300, 700, progress) for scroll-driven weight
```

### On-Demand Google Font Loading
```tsx
function useGoogleFont(family: string) {
  useEffect(() => {
    const id = `gf-${family.replace(/\s/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}
```

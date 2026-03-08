# Veritasium Style Guide

This document outlines the design principles, color palettes, and component
usage for Veritasium-style educational videos and interactive demos in
spike.land.

## Design Philosophy

- **High Contrast**: Dark backgrounds (`#0a0a0f`) with vibrant neon accents.
- **Glassmorphism**: Subtle translucent cards with blurred backgrounds for data
  overlays.
- **Kinetic Typography**: Italic, heavy, tracking-tighter fonts for punchy
  titles.
- **Motion-First**: Every transformation should be animated using smooth spring
  physics.
- **Physics-Driven**: Use metaphors from physics (attention spotlights,
  Darwinian selection, Bayesian confidence) to explain software concepts.

## Color Palette

### Base

- **Background**: `#0a0a0f`
- **Text Primary**: `#ffffff`
- **Text Secondary**: `#a0a0a0`

### Agent Loops & States

| State       | Color   | HEX       |
| ----------- | ------- | --------- |
| Planning    | Purple  | `#8B5CF6` |
| Generating  | Blue    | `#3B82F6` |
| Transpiling | Cyan    | `#06B6D4` |
| Fixing      | Amber   | `#F59E0B` |
| Learning    | Emerald | `#10B981` |
| Published   | Green   | `#22C55E` |
| Failed      | Red     | `#EF4444` |

### Bayesian Logic

- **Candidate**: `#EAB308` (Yellow)
- **Active**: `#22C55E` (Green)
- **Deprecated**: `#6B7280` (Gray)

## Components

### Core Components (`src/video/components/core/`)

Pure React components that take a `progress` prop (0-1) and encapsulate all
rendering logic.

- `AttentionSpotlightCore`: Explains the zero-sum nature of attention tokens.
- `FiveLayerStackCore`: Visualizes the structured context layers (Identity,
  Knowledge, etc.).
- `DarwinianTreeCore`: Simulates natural selection in code generation.
- `RecursiveZoomCore`: Demonstrates the fractal nature of context engineering.
- `AgentLoopCore`: Animates the states of a self-correcting agent.
- `ModelCascadeCore`: Shows the economic optimization of cascaded LLM calls.
- `BayesianConfidenceCore`: Visualizes the growth and pruning of learning notes.
- `SplitScreenCore`: A simple layout component for before/after comparisons.

## Typography

- **Headings**: `Inter`, Black, Italic, Tracking Tighter.
- **Code**: `JetBrains Mono` for precise technical details.

## Implementation Workflow

1. **Pure Logic**: Implement the rendering in a `*Core.tsx` component using
   absolute positioning and SVG.
2. **Progress Hooks**:
   - For Remotion: Wrap in `spring()` or `interpolate()` logic.
   - For Blog: Wrap in `useInViewProgress()` hook for scroll-triggered
     interaction.
3. **Register**: Add to `MDXComponents.tsx` for blog use or `Root.tsx` for video
   use.

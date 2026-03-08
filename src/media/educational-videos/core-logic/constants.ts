/**
 * Video configuration constants
 */
export const VIDEO_CONFIG = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 11194, // ~6m13s (audio-driven)
} as const;

/**
 * Vibe Coding Paradox — Scene Durations (frames @ 30fps)
 * Audio-driven: ceil(audioDuration * 30) + 30 (~1s buffer)
 */
export const VCP_DURATIONS = {
  hook: 1514, // ~50.5s (audio: 49.5s)
  physicsOfAttention: 1708, // ~56.9s (audio: 55.9s)
  beforeState: 574, // ~19.1s (audio: 18.1s)
  fiveLayerStack: 1520, // ~50.7s (audio: 49.6s)
  fixLoop: 1237, // ~41.2s (audio: 40.2s)
  agentMemory: 1238, // ~41.3s (audio: 40.3s)
  skillMatching: 1039, // ~34.6s (audio: 33.6s)
  metaBuild: 671, // ~22.4s (audio: 21.4s)
  results: 917, // ~30.6s (audio: 29.5s)
  endCard: 776, // ~25.9s (audio: 24.8s)
} as const;

export const VCP_TIMING = {
  totalFrames: 11194, // ~6m13s (audio-driven)
  fps: 30,
  transitionFrames: 20,
} as const;

/**
 * Brand colors from spike.land design system
 */
export const COLORS = {
  // Primary brand colors
  cyan: "#00E5FF",
  fuchsia: "#FF00FF",
  purple: "#9945FF",
  amber: "#F59E0B",
  gold: "#FBBF24",

  // Dark theme
  darkBg: "#0a0a0f",
  darkCard: "#1a1a2e",
  darkBorder: "#2a2a3e",

  // Text colors
  textPrimary: "#ffffff",
  textSecondary: "#a0a0a0",
  textMuted: "#6b7280",

  // Status colors
  success: "#22c55e",
  warning: "#eab308",
  error: "#ef4444",

  // Chart colors for A/B testing
  variantA: "#00E5FF", // Cyan
  variantB: "#FF00FF", // Fuchsia
} as const;

/**
 * Typography scale
 */
export const TYPOGRAPHY = {
  fontFamily: {
    sans: "Inter, system-ui, sans-serif",
    mono: "JetBrains Mono, monospace",
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30,
    "4xl": 36,
    "5xl": 48,
    "6xl": 60,
  },
} as const;

/**
 * Spring configurations for different animation feels
 */
export const SPRING_CONFIGS = {
  smooth: { damping: 200 },
  snappy: { damping: 20, stiffness: 200 },
  bouncy: { damping: 8 },
  heavy: { damping: 15, stiffness: 80, mass: 2 },
  gentle: { damping: 14, stiffness: 100 },
  slow: { damping: 40, stiffness: 60 },
} as const;

/**
 * Veritasium-specific color accents (reused for VCP)
 */
export const VERITASIUM_COLORS = {
  // Agent states
  planning: "#8B5CF6",
  generating: "#3B82F6",
  transpiling: "#06B6D4",
  fixing: "#F59E0B",
  learning: "#10B981",
  published: "#22C55E",
  failed: "#EF4444",

  // Note lifecycle
  candidate: "#EAB308",
  active: "#22C55E",
  deprecated: "#6B7280",

  // Laplace formula
  bayesian: "#A78BFA",

  // Flywheel
  flywheel: "#00E5FF",
} as const;

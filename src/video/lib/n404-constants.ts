/**
 * No More 404s — Scene Durations (frames @ 30fps)
 * Aligned to ElevenLabs audio: ceil(audioDuration * 30) + 60 (2s visual buffer)
 * Total: 7713 frames = 257s = 4 minutes 17 seconds
 */
export const N404_DURATIONS = {
  hook: 558, // 18.6s (audio: 16.6s)
  platform: 633, // 21.1s (audio: 19.1s)
  codespace: 639, // 21.3s (audio: 19.3s)
  learnit: 765, // 25.5s (audio: 23.5s)
  generate: 786, // 26.2s (audio: 24.2s)
  bazdmeg: 1350, // 45.0s (audio: 43.0s)
  breakthrough: 786, // 26.2s (audio: 24.2s)
  agents: 717, // 23.9s (audio: 21.9s)
  endCard: 648, // 21.6s (audio: 19.6s)
} as const;

export const N404_TIMING = {
  totalFrames: 7713, // 4 minutes 17 seconds
  fps: 30,
  transitionFrames: 20,
} as const;

// MCP tool count for video scenes — kept in sync with src/lib/docs/generated/tools-manifest.json
export const N404_MCP_TOOL_COUNT = 485;

import { N404_DURATIONS } from "./n404-constants";
import type { NarrationWord } from "./narration";

// NarrationWord re-exported for narration-timestamps consumer
export type { NarrationWord };

/**
 * Compute cumulative scene start frames
 */
const sceneKeys = Object.keys(N404_DURATIONS) as (keyof typeof N404_DURATIONS)[];
const sceneStartFrames: Record<string, number> = {};
let cumulative = 0;
for (const key of sceneKeys) {
  sceneStartFrames[key] = cumulative;
  cumulative += N404_DURATIONS[key];
}

/**
 * Get scene audio entries for Remotion <Audio> components.
 */
export function getN404SceneAudioEntries(): {
  sceneId: string;
  startFrame: number;
}[] {
  return sceneKeys.map((key) => ({
    sceneId: key,
    startFrame: sceneStartFrames[key] ?? 0,
  }));
}

import { VCP_DURATIONS, VCP_TIMING } from "./constants";
import { NARRATION_TIMESTAMPS } from "./narration-timestamps";

export interface NarrationWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

/**
 * Compute cumulative scene start frames
 */
const sceneKeys = Object.keys(VCP_DURATIONS) as (keyof typeof VCP_DURATIONS)[];
const sceneStartFrames: Record<string, number> = {};
let cumulative = 0;
for (const key of sceneKeys) {
  sceneStartFrames[key] = cumulative;
  cumulative += VCP_DURATIONS[key];
}

/**
 * Voice-active frame ranges for music ducking.
 * Uses actual audio durations from ElevenLabs timestamps when available,
 * falls back to full scene duration otherwise.
 */
export function getVoiceActiveFrames(): [number, number][] {
  return sceneKeys.map((key) => {
    const startFrame = sceneStartFrames[key] ?? 0;
    const timestamps = NARRATION_TIMESTAMPS[key];

    if (timestamps && timestamps.audioDurationSeconds > 0) {
      const audioDurationFrames = Math.ceil(timestamps.audioDurationSeconds * VCP_TIMING.fps);
      return [startFrame, startFrame + audioDurationFrames] as [number, number];
    }

    // Fallback: assume voice active throughout scene
    return [startFrame, startFrame + VCP_DURATIONS[key]] as [number, number];
  });
}

/**
 * Get scene audio entries for Remotion <Audio> components.
 * Returns scene IDs with their start frames for audio sequencing.
 */
export function getSceneAudioEntries(): {
  sceneId: string;
  startFrame: number;
}[] {
  return sceneKeys.map((key) => ({
    sceneId: key,
    startFrame: sceneStartFrames[key] ?? 0,
  }));
}

import { interpolate } from "remotion";

/**
 * Ducks music volume when voiceover is active
 * @param frame Current frame
 * @param voiceActiveFrames Array of [start, end] tuples when voice is active
 * @param baseVolume Normal music volume (0-1)
 * @param duckedVolume Volume when ducked (0-1)
 * @param fadeFrames Number of frames for fade in/out
 */
export const musicVolumeAtFrame = (
  frame: number,
  voiceActiveFrames: [number, number][],
  baseVolume: number = 0.4,
  duckedVolume: number = 0.12,
  fadeFrames: number = 8,
): number => {
  const volume = baseVolume;

  for (const [start, end] of voiceActiveFrames) {
    if (frame >= start - fadeFrames && frame <= end + fadeFrames) {
      // Ducking range
      const duckStart = start - fadeFrames;
      const duckEnd = start;
      const unduckStart = end;
      const unduckEnd = end + fadeFrames;

      if (frame >= duckStart && frame < duckEnd) {
        // Fading out (ducking)
        return interpolate(frame, [duckStart, duckEnd], [baseVolume, duckedVolume], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
      }

      if (frame >= duckEnd && frame <= unduckStart) {
        // Full ducked
        return duckedVolume;
      }

      if (frame > unduckStart && frame <= unduckEnd) {
        // Fading back in
        return interpolate(frame, [unduckStart, unduckEnd], [duckedVolume, baseVolume], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
      }
    }
  }

  return volume;
};

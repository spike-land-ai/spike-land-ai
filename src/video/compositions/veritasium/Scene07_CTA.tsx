import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { RecursiveZoomCore } from "../../components/core/RecursiveZoomCore";
import { SPRING_CONFIGS } from "../../lib/constants";

export function Scene07_CTA() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: SPRING_CONFIGS.slow,
    durationInFrames: 90,
  });

  return (
    <AbsoluteFill className="bg-black">
      <RecursiveZoomCore depth={4} progress={progress} className="w-full h-full" />
      <div className="absolute inset-x-0 bottom-24 flex flex-col items-center justify-center gap-4">
        <h1 className="text-7xl font-black text-white italic tracking-tighter uppercase">
          Build the future
        </h1>
        <div className="px-8 py-4 bg-white text-black text-2xl font-bold rounded-full">
          spike.land
        </div>
      </div>
    </AbsoluteFill>
  );
}

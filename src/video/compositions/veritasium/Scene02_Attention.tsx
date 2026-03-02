import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AttentionSpotlightCore } from "../../components/core/AttentionSpotlightCore";
import { SPRING_CONFIGS } from "../../lib/constants";

export function Scene02_Attention() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: SPRING_CONFIGS.gentle,
    durationInFrames: 90,
  });

  return (
    <AbsoluteFill className="bg-black">
      <AttentionSpotlightCore progress={progress} tokenCount={12} className="w-full h-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <h2 className="text-4xl font-bold text-white/50 italic tracking-tighter uppercase">
          Attention is a zero-sum game
        </h2>
      </div>
    </AbsoluteFill>
  );
}

import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SplitScreenCore } from "../../components/core/SplitScreenCore";
import { SPRING_CONFIGS } from "../../lib/constants";

export function Scene01_Hook() {
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
      <SplitScreenCore
        progress={progress}
        revealDirection="left-to-right"
        leftContent={
          <div className="flex items-center justify-center h-full bg-slate-900">
            <h1 className="text-6xl font-black text-white italic tracking-tighter">40% SUCCESS</h1>
          </div>
        }
        rightContent={
          <div className="flex items-center justify-center h-full bg-red-950">
            <h1 className="text-6xl font-black text-white italic tracking-tighter">60% FAILURE</h1>
          </div>
        }
      />
    </AbsoluteFill>
  );
}

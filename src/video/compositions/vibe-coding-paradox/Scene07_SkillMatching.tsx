import { type FC } from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { SkillMatchingDiagram } from "../../components/diagrams/SkillMatchingDiagram";
import { ImpedanceMatchingAnalogy } from "../../components/diagrams/ImpedanceMatchingAnalogy";

export const Scene07_SkillMatching: FC = () => {
  const frame = useCurrentFrame();

  // Second half: matched for first 260 frames, mismatched for last 259
  const impedanceFrame = frame - 520;
  const isMatched = impedanceFrame < 260;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Skill matching diagram with URL parsing (0-520) */}
      <Sequence from={0} durationInFrames={520}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SkillMatchingDiagram url="spike.land/create/games/tetris" delay={6} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Impedance matching analogy (520-1039) */}
      <Sequence from={520} durationInFrames={519}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ImpedanceMatchingAnalogy matched={isMatched} delay={6} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

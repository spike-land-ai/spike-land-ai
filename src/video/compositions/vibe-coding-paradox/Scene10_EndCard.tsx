import { type FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { TakeawayCards } from "../../components/ui/TakeawayCards";
import { SpikeLandLogo } from "../../components/branding/SpikeLandLogo";
import { GradientMesh } from "../../components/branding/GradientMesh";
import { KineticText } from "../../components/ui/KineticText";

export const Scene10_EndCard: FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Takeaway cards (0-388, ~12.9s) */}
      <Sequence from={0} durationInFrames={388}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
          }}
        >
          <TakeawayCards delay={6} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Logo with gradient mesh background (388-621, ~7.8s) */}
      <Sequence from={388} durationInFrames={233}>
        <AbsoluteFill>
          <GradientMesh animationSpeed={0.02} opacity={0.8} />
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SpikeLandLogo size={180} delay={394} />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Call to action text (621-776, ~5.2s) */}
      <Sequence from={621} durationInFrames={155}>
        <AbsoluteFill>
          <GradientMesh animationSpeed={0.02} opacity={0.6} />
          <AbsoluteFill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 60,
            }}
          >
            <SpikeLandLogo size={140} delay={0} animate={false} />
            <KineticText
              text="spike.land — Read the full article"
              fontSize={36}
              color={COLORS.textSecondary}
              type="slide"
              delay={633}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

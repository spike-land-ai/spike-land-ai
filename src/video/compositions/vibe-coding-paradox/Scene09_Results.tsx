import { type FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { SuccessRateChart } from "../../components/diagrams/SuccessRateChart";
import { CostValueChart } from "../../components/diagrams/CostValueChart";
import { DiminishingReturnsGraph } from "../../components/diagrams/DiminishingReturnsGraph";

export const Scene09_Results: FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Success rate comparison bars (0-306, ~10.2s) */}
      <Sequence from={0} durationInFrames={306}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SuccessRateChart revealCount={3} delay={5} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Cost vs value chart (306-611, ~10.2s) */}
      <Sequence from={306} durationInFrames={305}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CostValueChart delay={5} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Diminishing returns graph with competition line (611-917, ~10.2s) */}
      <Sequence from={611} durationInFrames={306}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DiminishingReturnsGraph showCompetitionLine={true} delay={5} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

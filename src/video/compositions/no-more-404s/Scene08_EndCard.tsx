import { type FC } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { KineticText } from "../../components/ui/KineticText";
import { ComparisonTable } from "../../components/diagrams/ComparisonTable";
import { BarChart } from "../../components/ui/BarChart";

export const Scene08_Breakthrough: FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: The Breakthrough - ComparisonTable (0-262) */}
      <Sequence from={0} durationInFrames={262}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          <KineticText
            text="The Breakthrough"
            fontSize={64}
            color={COLORS.textPrimary}
            type="reveal"
            delay={7}
          />
          <ComparisonTable
            delay={15}
            rows={[
              { label: "E2E Test", before: "30-300s", after: "<1ms" },
              { label: "CI Suite", before: "45 min", after: "3 min" },
              { label: "CI Shards", before: "1", after: "4 parallel" },
              { label: "Dev Setup", before: "5 min", after: "<1s" },
              { label: "Build Time", before: "30 min", after: "10s" },
            ]}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: BarChart - Speedup Factors (262-524) */}
      <Sequence from={262} durationInFrames={262}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize["4xl"],
              fontWeight: 700,
              color: COLORS.textPrimary,
              textAlign: "center",
              opacity: interpolate(frame, [269, 284], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Speedup Factors
          </div>
          <BarChart
            data={[
              { label: "E2E", value: 300000, color: COLORS.cyan },
              { label: "CI", value: 15, color: COLORS.purple },
              { label: "Dev", value: 300, color: COLORS.amber },
              { label: "Build", value: 180, color: COLORS.success },
            ]}
            maxValue={300000}
            height={350}
            barWidth={120}
            gap={40}
            delay={277}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Dramatic closing (524-786) */}
      <Sequence from={524} durationInFrames={262}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
          }}
        >
          <KineticText
            text="Your half-hour build"
            fontSize={56}
            color={COLORS.textPrimary}
            type="reveal"
            delay={539}
          />
          <KineticText
            text="gets to ten seconds"
            fontSize={72}
            color={COLORS.cyan}
            type="scale"
            delay={584}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

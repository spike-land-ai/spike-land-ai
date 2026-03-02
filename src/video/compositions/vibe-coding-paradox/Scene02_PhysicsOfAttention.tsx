import { type FC } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { COLORS, TYPOGRAPHY, VERITASIUM_COLORS } from "../../lib/constants";
import { TokenVisualization } from "../../components/animations/TokenVisualization";
import { SoftmaxEquation } from "../../components/ui/SoftmaxEquation";
import { AttentionSpotlight } from "../../components/animations/AttentionSpotlight";
import { AttentionPie } from "../../components/ui/AttentionPie";
import { AccuracyDropChart } from "../../components/diagrams/AccuracyDropChart";

export const Scene02_PhysicsOfAttention: FC = () => {
  const frame = useCurrentFrame();

  // Animate token count for AttentionSpotlight (frames 684-1026)
  const spotlightLocalFrame = frame - 684;
  const animatedTokenCount = Math.round(
    interpolate(spotlightLocalFrame, [0, 342], [3, 20], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // Engineered pie (3 segments, equal)
  const engineeredSegments = [
    { label: "Identity", value: 33, color: VERITASIUM_COLORS.planning },
    { label: "Knowledge", value: 33, color: VERITASIUM_COLORS.generating },
    { label: "Tools", value: 34, color: VERITASIUM_COLORS.learning },
  ];

  // Vibe coded pie (20 small random segments)
  const vibeSegments = Array.from({ length: 20 }, (_, i) => ({
    label: `tok-${i}`,
    value: 4 + Math.sin(i * 3.7) * 3,
    color: [
      VERITASIUM_COLORS.planning,
      VERITASIUM_COLORS.generating,
      VERITASIUM_COLORS.transpiling,
      VERITASIUM_COLORS.fixing,
      VERITASIUM_COLORS.learning,
      COLORS.cyan,
      COLORS.fuchsia,
      COLORS.amber,
    ][i % 8]!,
  }));

  // Subtle continuous camera zoom for visual momentum
  const sceneZoom = interpolate(frame, [0, 1708], [1.0, 1.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${sceneZoom})`,
        }}
      >
        {/* Part 1: Token visualization */}
        <Sequence from={0} durationInFrames={342}>
          <TokenVisualization
            text="A token is the atomic unit of an AI model's world"
            delay={9}
            tokensPerWord={2}
          />
        </Sequence>

        {/* Part 2: Softmax equation */}
        <Sequence from={342} durationInFrames={342}>
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
                fontSize: 28,
                fontWeight: 700,
                color: COLORS.textSecondary,
                opacity: interpolate(frame - 342, [0, 13], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              The Attention Mechanism
            </div>
            <SoftmaxEquation variant="softmax" delay={354} />
            <div
              style={{
                fontSize: 18,
                color: COLORS.textMuted,
                maxWidth: 700,
                textAlign: "center",
                lineHeight: 1.6,
                fontFamily: TYPOGRAPHY.fontFamily.mono,
                opacity: interpolate(frame - 342, [38, 57], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Each token competes for attention. More tokens = less attention per token.
            </div>
          </AbsoluteFill>
        </Sequence>

        {/* Part 3: Attention spotlight - growing token count */}
        <Sequence from={684} durationInFrames={342}>
          <AttentionSpotlight tokenCount={animatedTokenCount} delay={5} />
        </Sequence>

        {/* Part 4: Two AttentionPie charts side-by-side */}
        <Sequence from={1026} durationInFrames={341}>
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 120,
            }}
          >
            {/* Engineered prompt - 3 segments */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: COLORS.success,
                  opacity: interpolate(frame - 1026, [0, 13], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                Engineered Prompt
              </div>
              <AttentionPie segments={engineeredSegments} size={360} delay={1035} />
              <div
                style={{
                  fontSize: 16,
                  color: COLORS.textMuted,
                  fontFamily: TYPOGRAPHY.fontFamily.mono,
                  opacity: interpolate(frame - 1026, [25, 38], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                3 sections — high attention each
              </div>
            </div>

            {/* Vibe coded - 20 segments */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: COLORS.error,
                  opacity: interpolate(frame - 1026, [19, 32], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                Vibe Coded Prompt
              </div>
              <AttentionPie segments={vibeSegments} size={360} delay={1054} />
              <div
                style={{
                  fontSize: 16,
                  color: COLORS.textMuted,
                  fontFamily: TYPOGRAPHY.fontFamily.mono,
                  opacity: interpolate(frame - 1026, [44, 57], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                20 fragments — diluted attention
              </div>
            </div>
          </AbsoluteFill>
        </Sequence>

        {/* Part 5: Accuracy drop chart */}
        <Sequence from={1367} durationInFrames={341}>
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AccuracyDropChart delay={1377} />
          </AbsoluteFill>
        </Sequence>
      </div>
    </AbsoluteFill>
  );
};

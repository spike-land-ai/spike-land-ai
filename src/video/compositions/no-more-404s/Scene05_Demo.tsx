import { type FC } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY, VERITASIUM_COLORS } from "../../lib/constants";
import { typewriter } from "../../lib/animations";
import { FourOhFourSkull } from "../../components/animations/FourOhFourSkull";
import { RoutePipelineDiagram } from "../../components/diagrams/RoutePipelineDiagram";
import { ReviewerAgentCard } from "../../components/ui/ReviewerAgentCard";
import { ELOChartDiagram } from "../../components/diagrams/ELOChartDiagram";
import { BrowserFrame } from "../../components/mockups/BrowserFrame";

export const Scene05_Generate: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const browserUrl = typewriter(frame, fps, "spike.land/create/anything", 16, 10);

  // Skull fade out around frame 118
  const skullOpacity = interpolate(frame, [118, 144], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Building..." text fades in after skull fades out
  const buildingOpacity = interpolate(frame, [144, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pipeline reveal count: animate from 0 to 6 across frames 262-491
  const pipelineRevealCount = Math.floor(
    interpolate(frame, [262, 491], [0, 6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // "Better reviewers..." text fade-in
  const betterReviewersOpacity = interpolate(frame, [688, 721], [0, 1], {
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
      {/* Part 1: FourOhFourSkull + BrowserFrame (0-262) */}
      <Sequence from={0} durationInFrames={262}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
            padding: "60px 80px",
          }}
        >
          <BrowserFrame url={browserUrl} width={900} height={500}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                background: `linear-gradient(135deg, ${COLORS.darkBg}, #1a0f1a)`,
                position: "relative",
              }}
            >
              {/* 404 Skull */}
              <div style={{ opacity: skullOpacity }}>
                <FourOhFourSkull delay={0} />
              </div>

              {/* "Building..." text replaces skull */}
              <div
                style={{
                  position: "absolute",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  opacity: buildingOpacity,
                }}
              >
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    color: COLORS.cyan,
                    fontFamily: TYPOGRAPHY.fontFamily.mono,
                    textShadow: `0 0 40px ${COLORS.cyan}60`,
                  }}
                >
                  Building...
                </div>
                {/* Animated dots / spinner bar */}
                <div
                  style={{
                    width: 200,
                    height: 4,
                    borderRadius: 2,
                    background: `${COLORS.cyan}30`,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: 80,
                      height: 4,
                      borderRadius: 2,
                      background: COLORS.cyan,
                      transform: `translateX(${interpolate(frame % 60, [0, 60], [-80, 200])}px)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </BrowserFrame>
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Six-Stage Pipeline (262-524) */}
      <Sequence from={262} durationInFrames={262}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 60,
            padding: "80px 60px",
          }}
        >
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize["4xl"],
              fontWeight: 700,
              color: COLORS.textPrimary,
              opacity: spring({
                frame: frame - 269,
                fps,
                config: SPRING_CONFIGS.smooth,
              }),
            }}
          >
            Six-Stage Pipeline
          </div>

          <RoutePipelineDiagram revealCount={pipelineRevealCount} delay={275} />
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Reviewer Cards + ELO Chart (524-786) */}
      <Sequence from={524} durationInFrames={262}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 40,
            padding: "60px 60px",
          }}
        >
          {/* Two reviewer cards side by side */}
          <div
            style={{
              display: "flex",
              gap: 40,
              justifyContent: "center",
            }}
          >
            <ReviewerAgentCard
              name="Plan Reviewer"
              model="claude-opus-4-6"
              elo={1650}
              wins={142}
              losses={28}
              color={VERITASIUM_COLORS.planning}
              delay={531}
            />
            <ReviewerAgentCard
              name="Code Reviewer"
              model="claude-sonnet-4-5"
              elo={1420}
              wins={98}
              losses={52}
              color={COLORS.amber}
              delay={544}
            />
          </div>

          {/* ELO Chart */}
          <ELOChartDiagram delay={570} />

          {/* "Better reviewers get selected more often" */}
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize["2xl"],
              fontWeight: 600,
              color: COLORS.textSecondary,
              textAlign: "center",
              opacity: betterReviewersOpacity,
            }}
          >
            Better reviewers get selected more often
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

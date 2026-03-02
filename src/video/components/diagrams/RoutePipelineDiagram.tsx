import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { stagger } from "../../lib/animations";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY, VERITASIUM_COLORS } from "../../lib/constants";

type RoutePipelineDiagramProps = {
  revealCount?: number;
  delay?: number;
};

const PIPELINE_STEPS = [
  { label: "URL", color: COLORS.cyan },
  { label: "Generate", color: VERITASIUM_COLORS.generating },
  { label: "Review", color: VERITASIUM_COLORS.planning },
  { label: "Transpile", color: VERITASIUM_COLORS.transpiling },
  { label: "Cache", color: COLORS.amber },
  { label: "Serve", color: VERITASIUM_COLORS.published },
];

export function RoutePipelineDiagram({ revealCount = 6, delay = 0 }: RoutePipelineDiagramProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const boxWidth = 150;
  const boxHeight = 60;
  const arrowWidth = 50;
  const totalStepWidth = boxWidth + arrowWidth;
  const totalWidth = PIPELINE_STEPS.length * boxWidth + (PIPELINE_STEPS.length - 1) * arrowWidth;
  const startX = 960 - totalWidth / 2;

  return (
    <div
      style={{
        position: "relative",
        width: 960,
        height: 200,
        display: "flex",
        alignItems: "center",
      }}
    >
      {PIPELINE_STEPS.map((step, index) => {
        if (index >= revealCount) return null;

        const itemDelay = delay + stagger(index, 8);
        const progress = spring({
          frame: frame - itemDelay,
          fps,
          config: SPRING_CONFIGS.snappy,
        });

        const x = startX + index * totalStepWidth - 480;

        return (
          <div key={step.label}>
            {/* Step Box */}
            <div
              style={{
                position: "absolute",
                left: x,
                top: 70,
                width: boxWidth,
                height: boxHeight,
                borderRadius: 12,
                background: `${step.color}15`,
                border: `2px solid ${step.color}60`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${progress})`,
                opacity: progress,
                boxShadow: `0 4px 20px ${step.color}20`,
              }}
            >
              <span
                style={{
                  fontSize: TYPOGRAPHY.fontSize.base,
                  fontWeight: 600,
                  color: step.color,
                  fontFamily: TYPOGRAPHY.fontFamily.sans,
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Arrow to next step */}
            {index < revealCount - 1 && index < PIPELINE_STEPS.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  left: x + boxWidth,
                  top: 92,
                  width: arrowWidth,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: progress,
                }}
              >
                <svg width={arrowWidth} height="16" viewBox={`0 0 ${arrowWidth} 16`}>
                  <line
                    x1="4"
                    y1="8"
                    x2={arrowWidth - 10}
                    y2="8"
                    stroke={COLORS.textMuted}
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <polygon
                    points={`${arrowWidth - 10},3 ${arrowWidth - 2},8 ${arrowWidth - 10},13`}
                    fill={COLORS.textMuted}
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

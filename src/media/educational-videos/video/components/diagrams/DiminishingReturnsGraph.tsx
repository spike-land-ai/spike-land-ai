import { type FC, Fragment } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../../core-logic/constants";

type DiminishingReturnsGraphProps = {
  delay?: number;
  showCompetitionLine?: boolean;
};

// Generate points for the diminishing returns curve
// Sharp rise 0-3, plateau 3-5, flat 5-10
function getCurvePoints(): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= 20; i++) {
    const x = i * 0.5; // 0 to 10
    // Logarithmic-style curve: sharp rise then plateau
    const y = Math.min(95, (60 * Math.log(x + 1)) / Math.log(4));
    points.push({ x, y });
  }
  return points;
}

// Generate points for competition line (linear increase)
function getCompetitionPoints(): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= 20; i++) {
    const x = i * 0.5;
    const y = 8 * x + 5; // Linear increase
    points.push({ x, y });
  }
  return points;
}

function pointsToSvgPath(
  points: Array<{ x: number; y: number }>,
  chartWidth: number,
  chartHeight: number,
  padX: number,
  padY: number,
): string {
  return points
    .map((p, i) => {
      const sx = padX + (p.x / 10) * chartWidth;
      const sy = padY + chartHeight - (p.y / 100) * chartHeight;
      return `${i === 0 ? "M" : "L"} ${sx} ${sy}`;
    })
    .join(" ");
}

export const DiminishingReturnsGraph: FC<DiminishingReturnsGraphProps> = ({
  delay = 0,
  showCompetitionLine = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  const drawProgress = interpolate(frame, [delay + 10, delay + 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const competitionProgress = interpolate(frame, [delay + 35, delay + 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const annotationOpacity = interpolate(frame, [delay + 55, delay + 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const svgWidth = 700;
  const svgHeight = 400;
  const padX = 70;
  const padY = 20;
  const chartWidth = svgWidth - padX - 40;
  const chartHeight = svgHeight - padY - 60;

  const curvePoints = getCurvePoints();
  const competitionPoints = getCompetitionPoints();

  const mainPath = pointsToSvgPath(curvePoints, chartWidth, chartHeight, padX, padY);
  const competitionPath = pointsToSvgPath(competitionPoints, chartWidth, chartHeight, padX, padY);

  // Approximate path length for stroke animation
  const pathLength = 1200;
  const competitionPathLength = 1000;

  // Annotation position (at approximately x=4, where plateau starts)
  const annotX = padX + (4 / 10) * chartWidth;
  const annotY = padY + chartHeight - ((60 * Math.log(5)) / Math.log(4) / 100) * chartHeight;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.textPrimary,
          fontFamily: "Inter, sans-serif",
          opacity: titleProgress,
        }}
      >
        Diminishing Returns of Learning Notes
      </div>

      <svg width={svgWidth} height={svgHeight}>
        {/* Y-axis */}
        <line
          x1={padX}
          y1={padY}
          x2={padX}
          y2={padY + chartHeight}
          stroke={COLORS.darkBorder}
          strokeWidth={2}
          opacity={titleProgress}
        />
        {/* X-axis */}
        <line
          x1={padX}
          y1={padY + chartHeight}
          x2={padX + chartWidth}
          y2={padY + chartHeight}
          stroke={COLORS.darkBorder}
          strokeWidth={2}
          opacity={titleProgress}
        />

        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = padY + chartHeight - (val / 100) * chartHeight;
          return (
            <Fragment key={val}>
              <text
                x={padX - 12}
                y={y + 4}
                textAnchor="end"
                fill={COLORS.textMuted}
                fontSize={12}
                fontFamily="JetBrains Mono, monospace"
                opacity={titleProgress}
              >
                {val}%
              </text>
              <line
                x1={padX}
                y1={y}
                x2={padX + chartWidth}
                y2={y}
                stroke={COLORS.darkBorder}
                strokeWidth={0.5}
                opacity={titleProgress * 0.3}
              />
            </Fragment>
          );
        })}

        {/* X-axis labels */}
        {[0, 2, 4, 6, 8, 10].map((val) => {
          const x = padX + (val / 10) * chartWidth;
          return (
            <text
              key={val}
              x={x}
              y={padY + chartHeight + 24}
              textAnchor="middle"
              fill={COLORS.textMuted}
              fontSize={12}
              fontFamily="JetBrains Mono, monospace"
              opacity={titleProgress}
            >
              {val}
            </text>
          );
        })}

        {/* Axis titles */}
        <text
          x={padX + chartWidth / 2}
          y={padY + chartHeight + 48}
          textAnchor="middle"
          fill={COLORS.textSecondary}
          fontSize={14}
          fontFamily="Inter, sans-serif"
          opacity={titleProgress}
        >
          Learning Notes
        </text>
        <text
          x={16}
          y={padY + chartHeight / 2}
          textAnchor="middle"
          fill={COLORS.textSecondary}
          fontSize={14}
          fontFamily="Inter, sans-serif"
          opacity={titleProgress}
          transform={`rotate(-90, 16, ${padY + chartHeight / 2})`}
        >
          Improvement %
        </text>

        {/* Main curve */}
        <path
          d={mainPath}
          fill="none"
          stroke={COLORS.cyan}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={pathLength}
          strokeDashoffset={pathLength * (1 - drawProgress)}
        />

        {/* Competition line (red dashed) */}
        {showCompetitionLine && (
          <path
            d={competitionPath}
            fill="none"
            stroke={COLORS.error}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="8 6"
            opacity={competitionProgress * 0.8}
            strokeDashoffset={
              competitionPathLength * (1 - competitionProgress) + competitionPathLength
            }
            style={{
              strokeDasharray: `${
                competitionPathLength * competitionProgress
              } ${competitionPathLength}`,
            }}
          />
        )}

        {/* Competition line label */}
        {showCompetitionLine && (
          <text
            x={padX + chartWidth - 20}
            y={padY + 20}
            textAnchor="end"
            fill={COLORS.error}
            fontSize={13}
            fontFamily="Inter, sans-serif"
            fontWeight={600}
            opacity={competitionProgress}
          >
            Attention competition
          </text>
        )}

        {/* Annotation at plateau */}
        <g opacity={annotationOpacity}>
          <circle cx={annotX} cy={annotY} r={6} fill={COLORS.cyan} opacity={0.8} />
          <line
            x1={annotX}
            y1={annotY - 8}
            x2={annotX}
            y2={annotY - 40}
            stroke={COLORS.textMuted}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <rect
            x={annotX - 75}
            y={annotY - 66}
            width={150}
            height={24}
            rx={6}
            fill={`${COLORS.darkCard}ee`}
            stroke={COLORS.amber}
            strokeWidth={1}
          />
          <text
            x={annotX}
            y={annotY - 50}
            textAnchor="middle"
            fill={COLORS.amber}
            fontSize={12}
            fontFamily="Inter, sans-serif"
            fontWeight={600}
          >
            Diminishing returns
          </text>
        </g>
      </svg>
    </div>
  );
};

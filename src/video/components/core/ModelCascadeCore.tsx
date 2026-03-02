import { type FC, useId } from "react";
import { COLORS } from "../../lib/constants";
import { clamp, interpolate } from "../../lib/animation-utils";

export type ModelTier = "opus" | "sonnet" | "haiku";

export type ModelCascadeCoreProps = {
  hoveredTier: ModelTier | null;
  progress: number;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
};

const MODELS: Record<
  ModelTier,
  {
    label: string;
    desc: string;
    cost: string;
    speed: string;
    width: number;
    x: number;
    color: string;
    yOffset: number;
  }
> = {
  opus: {
    label: "Claude 3.5 Opus",
    desc: "Broad semantic search / Deep logic",
    cost: "100%",
    speed: "1x",
    width: 600,
    x: 960,
    color: "#8b5cf6",
    yOffset: 200,
  }, // Violet
  sonnet: {
    label: "Claude 3.5 Sonnet",
    desc: "Targeted refactoring / Code generation",
    cost: "50%",
    speed: "4x",
    width: 400,
    x: 960,
    color: "#3b82f6",
    yOffset: 450,
  }, // Blue
  haiku: {
    label: "Claude 3.5 Haiku",
    desc: "Pinpoint fixes / Small diffs",
    cost: "5%",
    speed: "20x",
    width: 250,
    x: 960,
    color: "#0ea5e9",
    yOffset: 700,
  }, // Sky
};

export const ModelCascadeCore: FC<ModelCascadeCoreProps> = ({
  hoveredTier,
  progress,
  width = 1920,
  height = 1080,
  className,
  style,
}) => {
  const id = useId();

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{
        background: COLORS.darkBg,
        fontFamily: "Inter, sans-serif",
        ...style,
      }}
    >
      <defs>
        {/* Generative grid */}
        <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={COLORS.textMuted} strokeOpacity={0.05} />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Glow Filters */}
        <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="15" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`strongGlow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="30" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Beam Gradients */}
        {Object.entries(MODELS).map(([tier, m]) => (
          <linearGradient key={`beam-grad-${tier}`} id={`beam-${tier}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={m.color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={m.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      <g style={{ transform: "translate(0, 100px)" }}>
        {/* Title/Source at Top */}
        <g transform={`translate(960, 50)`} opacity={clamp(progress * 2, 0, 1)}>
          <circle
            cx={0}
            cy={0}
            r={40}
            fill="none"
            stroke={COLORS.textMuted}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <circle
            cx={0}
            cy={0}
            r={80}
            fill="none"
            stroke={COLORS.textMuted}
            strokeWidth={1}
            strokeDasharray="2 8"
            opacity={0.5}
          />
          <circle cx={0} cy={0} r={20} fill={COLORS.textPrimary} filter={`url(#glow-${id})`} />
          <text
            y={-60}
            textAnchor="middle"
            fill={COLORS.textPrimary}
            fontSize={14}
            fontWeight={800}
            letterSpacing={4}
            className="uppercase font-mono"
          >
            The Context Funnel
          </text>

          {/* Data particles entering cascade */}
          <path
            d="M 0 -100 L 0 0"
            stroke={COLORS.textPrimary}
            strokeWidth={2}
            strokeDasharray="4 8"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="12;0"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </path>
        </g>

        {/* Render Beams (behind cards) */}
        {Object.entries(MODELS).map(([tier, model], i) => {
          const tierProgress = clamp(progress * 2.5 - i * 0.3, 0, 1);
          if (tierProgress <= 0) return null;

          const isHovered = hoveredTier === tier;
          const isAnyHovered = hoveredTier !== null;
          // If something else is hovered, dim this beam heavily
          const baseOpacity = isAnyHovered && !isHovered ? 0.2 : 1;
          const targetOpacity = baseOpacity * tierProgress;

          // Calculate beam shape (starts wide, gets narrower)
          // If it's the first one, it comes from the source. Otherwise from the previous card.
          const prevModel = (i > 0 ? Object.values(MODELS)[i - 1] : undefined) ?? {
            yOffset: 50,
            width: 200,
          };
          const startY = prevModel.yOffset + 40; // bottom of previous
          const endY = model.yOffset - 40; // top of current

          const bwStart = prevModel.width * 0.8;
          const bwEnd = model.width * 0.9;

          return (
            <g key={`beam-${tier}`} opacity={targetOpacity} style={{ transition: "opacity 0.4s" }}>
              <polygon
                points={`
                       ${960 - bwStart / 2},${startY} 
                       ${960 + bwStart / 2},${startY} 
                       ${960 + bwEnd / 2},${endY} 
                       ${960 - bwEnd / 2},${endY}
                    `}
                fill={`url(#beam-${tier})`}
                filter={isHovered ? `url(#glow-${id})` : ""}
              />

              {/* Internal signal traces in the beam */}
              <path
                d={`M ${960 - bwStart / 4} ${startY} L ${960 - bwEnd / 4} ${endY}`}
                stroke={model.color}
                strokeWidth={1}
                opacity={0.4}
                strokeDasharray="8 4"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="12;0"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>
              <path
                d={`M ${960 + bwStart / 4} ${startY} L ${960 + bwEnd / 4} ${endY}`}
                stroke={model.color}
                strokeWidth={1}
                opacity={0.4}
                strokeDasharray="8 4"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  values="12;0"
                  dur="0.8s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          );
        })}

        {/* Render Cards */}
        {Object.entries(MODELS).map(([tier, model], i) => {
          const tierProgress = clamp(progress * 2.5 - i * 0.3, 0, 1);
          if (tierProgress <= 0) return null;

          const isHovered = hoveredTier === tier;
          const isAnyHovered = hoveredTier !== null;

          const targetOpacity = isAnyHovered && !isHovered ? 0.3 : 1;
          const targetScale = isHovered ? 1.05 : 1;

          const yPos = interpolate(tierProgress, [0, 1], [model.yOffset - 50, model.yOffset]);

          return (
            <g
              key={tier}
              transform={`translate(${model.x}, ${yPos}) scale(${targetScale})`}
              opacity={tierProgress * targetOpacity}
              style={{ transition: "all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
            >
              {/* Card Base */}
              <rect
                x={-model.width / 2}
                y={-40}
                width={model.width}
                height={80}
                rx={4}
                fill="rgba(10, 15, 20, 0.9)"
                stroke={model.color}
                strokeWidth={isHovered ? 2 : 1}
                strokeOpacity={isHovered ? 1 : 0.4}
                filter={isHovered ? `url(#strongGlow-${id})` : ""}
              />

              {/* Technical framing elements */}
              <path
                d={`M ${-model.width / 2 - 10} -20 L ${-model.width / 2} -20`}
                stroke={model.color}
                strokeWidth={1}
              />
              <path
                d={`M ${model.width / 2} 20 L ${model.width / 2 + 10} 20`}
                stroke={model.color}
                strokeWidth={1}
              />

              {/* Cost Data Block */}
              <rect
                x={-model.width / 2 + 20}
                y={-20}
                width={80}
                height={40}
                rx={2}
                fill={`${model.color}20`}
              />
              <text
                x={-model.width / 2 + 30}
                y={0}
                fill={COLORS.textMuted}
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
              >
                COST
              </text>
              <text
                x={-model.width / 2 + 30}
                y={15}
                fill={model.color}
                fontSize={14}
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
              >
                {model.cost}
              </text>

              {/* Central Details */}
              <text
                x={0}
                y={-5}
                fill={COLORS.textPrimary}
                fontSize={22}
                fontWeight="bold"
                textAnchor="middle"
                fontFamily="Inter, sans-serif"
              >
                {model.label}
              </text>
              <text
                x={0}
                y={18}
                fill={COLORS.textMuted}
                fontSize={13}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                className="uppercase tracking-widest"
              >
                // {model.desc}
              </text>

              {/* Speed Data Block */}
              <rect
                x={model.width / 2 - 100}
                y={-20}
                width={80}
                height={40}
                rx={2}
                fill={`${model.color}20`}
              />
              <text
                x={model.width / 2 - 90}
                y={0}
                fill={COLORS.textMuted}
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
              >
                SPEED
              </text>
              <text
                x={model.width / 2 - 90}
                y={15}
                fill={model.color}
                fontSize={14}
                fontWeight="bold"
                fontFamily="JetBrains Mono, monospace"
              >
                {model.speed}
              </text>

              {/* Activity indicator when hovered */}
              {isHovered && (
                <g>
                  <circle
                    cx={-model.width / 2 + 8}
                    cy={-32}
                    r={3}
                    fill={model.color}
                    filter={`url(#glow-${id})`}
                  >
                    <animate
                      attributeName="opacity"
                      values="1;0;1"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <text
                    x={-model.width / 2 + 16}
                    y={-29}
                    fill={model.color}
                    fontSize={8}
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                  >
                    ACTIVE
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

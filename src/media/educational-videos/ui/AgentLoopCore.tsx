import { type FC, useId } from "react";
import { COLORS } from "../core-logic/constants";
import { clamp } from "../core-logic/animation-utils";

export type AgentState = "planning" | "generating" | "transpiling" | "fixing" | "learning";

export type AgentLoopCoreProps = {
  activeState: AgentState;
  progress: number; // 0-1 across the entire loop (could be used for general entrance)
  isPaused?: boolean;
  width?: number;
  height?: number;
  className?: string;
};

const STATE_CONFIG: Record<
  AgentState,
  { label: string; angle: number; color: string; icon: string }
> = {
  planning: {
    label: "Planning",
    angle: -Math.PI / 2,
    color: "#3b82f6",
    icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  }, // Blue
  generating: {
    label: "Generating",
    angle: -Math.PI / 10,
    color: "#8b5cf6",
    icon: "M12 2L2 22l10-4 10 4L12 2z",
  }, // Violet
  transpiling: {
    label: "Transpiling",
    angle: (3 * Math.PI) / 10,
    color: "#d946ef",
    icon: "M4 17l6-6-6-6M12 19h8",
  }, // Fuchsia
  fixing: {
    label: "Fixing",
    angle: (7 * Math.PI) / 10,
    color: "#ef4444",
    icon: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  }, // Red
  learning: {
    label: "Learning",
    angle: (11 * Math.PI) / 10,
    color: "#10b981",
    icon: "M22 12h-4l-3 9L9 3l-3 9H2",
  }, // Emerald
};

const ORDERED_STATES: AgentState[] = [
  "planning",
  "generating",
  "transpiling",
  "fixing",
  "learning",
];

export const AgentLoopCore: FC<AgentLoopCoreProps> = ({
  activeState,
  progress,
  isPaused = false,
  width = 1920,
  height = 1080,
  className,
}) => {
  const cx = width / 2;
  const cy = height / 2;
  const orbitRadius = 320;

  const id = useId();
  const filterId = `glow-${id.replace(/:/g, "")}`;

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
      }}
    >
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS.cyan} stopOpacity={0.15} />
          <stop offset="100%" stopColor={COLORS.cyan} stopOpacity={0} />
        </radialGradient>

        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.textMuted} opacity={0.3} />
        </marker>
      </defs>

      {/* Orbit tracks */}
      <circle
        cx={cx}
        cy={cy}
        r={orbitRadius}
        fill="none"
        stroke={COLORS.textMuted}
        strokeWidth="1"
        strokeDasharray="4 8"
        opacity={0.2 * progress}
      />
      <circle
        cx={cx}
        cy={cy}
        r={orbitRadius + 40}
        fill="none"
        stroke={COLORS.textMuted}
        strokeWidth="1"
        strokeDasharray="1 16"
        opacity={0.1 * progress}
      />
      <circle
        cx={cx}
        cy={cy}
        r={orbitRadius - 40}
        fill="none"
        stroke={COLORS.textMuted}
        strokeWidth="1"
        strokeDasharray="2 12"
        opacity={0.15 * progress}
      />

      {/* Central Hub (Memory / Context) */}
      <g
        transform={`translate(${cx}, ${cy}) scale(${0.8 + 0.2 * progress})`}
        opacity={Math.min(1, progress * 3)}
      >
        <circle cx={0} cy={0} r={180} fill="url(#hubGlow)" />
        {/* Rotating core elements */}
        <g>
          {!isPaused && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="360"
              dur="40s"
              repeatCount="indefinite"
            />
          )}
          <circle
            cx={0}
            cy={0}
            r={100}
            fill="rgba(10,15,20,0.8)"
            stroke={COLORS.cyan}
            strokeOpacity={0.4}
            strokeWidth={1}
          />
          <circle
            cx={0}
            cy={0}
            r={110}
            fill="none"
            stroke={COLORS.cyan}
            strokeWidth={1}
            strokeDasharray="2 6 20 12"
            opacity={0.5}
          />
          <circle
            cx={0}
            cy={0}
            r={90}
            fill="none"
            stroke={COLORS.cyan}
            strokeWidth={2}
            strokeDasharray="40 80"
            opacity={0.3}
          />
        </g>

        <text
          y={-10}
          textAnchor="middle"
          fill={COLORS.textPrimary}
          fontSize={20}
          fontWeight={800}
          letterSpacing={4}
        >
          SHARED
        </text>
        <text
          y={15}
          textAnchor="middle"
          fill={COLORS.cyan}
          fontSize={14}
          fontWeight={600}
          letterSpacing={2}
        >
          CONTEXT
        </text>

        {/* Data blocks in hub */}
        <rect x={-40} y={35} width={16} height={4} fill={COLORS.cyan} opacity={0.6} />
        <rect x={-15} y={35} width={30} height={4} fill={COLORS.cyan} opacity={0.3} />
        <rect x={25} y={35} width={10} height={4} fill={COLORS.cyan} opacity={0.8} />
      </g>

      {/* Connections from states to Hub */}
      {ORDERED_STATES.map((state) => {
        const config = STATE_CONFIG[state];
        const x = cx + Math.cos(config.angle) * orbitRadius;
        const y = cy + Math.sin(config.angle) * orbitRadius;
        const isActive = state === activeState;

        return (
          <line
            key={`hub-conn-${state}`}
            x1={cx + Math.cos(config.angle) * 100}
            y1={cy + Math.sin(config.angle) * 100}
            x2={x - Math.cos(config.angle) * 60}
            y2={y - Math.sin(config.angle) * 60}
            stroke={isActive ? config.color : COLORS.textMuted}
            strokeWidth={isActive ? 2 : 1}
            strokeDasharray={isActive ? "none" : "4 4"}
            opacity={isActive ? 0.6 : 0.1}
            filter={isActive ? `url(#${filterId})` : ""}
          />
        );
      })}

      {/* Orbiting States */}
      {ORDERED_STATES.map((state, index) => {
        const config = STATE_CONFIG[state];
        const x = cx + Math.cos(config.angle) * orbitRadius;
        const y = cy + Math.sin(config.angle) * orbitRadius;
        const isActive = state === activeState;

        // Connect to next state
        const nextState = ORDERED_STATES[(index + 1) % ORDERED_STATES.length];
        if (!nextState) return null; // Should not happen with static array, but satisfies TS

        const nextConfig = STATE_CONFIG[nextState];
        const nextX = cx + Math.cos(nextConfig.angle) * orbitRadius;
        const nextY = cy + Math.sin(nextConfig.angle) * orbitRadius;

        // Calculate curve for outer connection
        const midX = (x + nextX) / 2;
        const midY = (y + nextY) / 2;
        // Push curve out from center
        const dist = Math.sqrt(Math.pow(midX - cx, 2) + Math.pow(midY - cy, 2));
        const pushOutRatio = (orbitRadius + 80) / dist;
        const controlX = cx + (midX - cx) * pushOutRatio;
        const controlY = cy + (midY - cy) * pushOutRatio;

        // Reveal timing based on progress
        const nodeProgress = clamp(progress * 1.5 - index * 0.1, 0, 1);
        if (nodeProgress <= 0) return null;

        return (
          <g key={state} opacity={nodeProgress}>
            {/* Edge to next node */}
            <path
              d={`M ${x} ${y} Q ${controlX} ${controlY} ${nextX} ${nextY}`}
              fill="none"
              stroke={isActive ? config.color : COLORS.textMuted}
              strokeWidth={isActive ? 2 : 1}
              opacity={isActive ? 0.8 : 0.2}
              strokeDasharray={isActive ? "8 4" : "4 8"}
              markerEnd="url(#arrowhead)"
              filter={isActive ? `url(#${filterId})` : ""}
            />

            {/* Active pulse traveling to next node */}
            {isActive && !isPaused && (
              <circle r={4} fill={config.color} filter={`url(#${filterId})`}>
                <animateMotion
                  dur="2s"
                  repeatCount="indefinite"
                  path={`M ${x} ${y} Q ${controlX} ${controlY} ${nextX} ${nextY}`}
                />
              </circle>
            )}

            {/* State Node Group */}
            <g
              transform={`translate(${x}, ${y}) scale(${isActive ? 1.1 : 1})`}
              style={{
                transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            >
              {/* Node Background */}
              <circle
                cx={0}
                cy={0}
                r={isActive ? 45 : 35}
                fill="rgba(10,15,20, 0.9)"
                stroke={isActive ? config.color : `${config.color}40`}
                strokeWidth={isActive ? 2 : 1}
                filter={isActive ? `url(#${filterId})` : ""}
              />

              {/* Icon */}
              <g transform="translate(-12, -20) scale(1)">
                <path
                  d={config.icon}
                  fill="none"
                  stroke={isActive ? "#fff" : config.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>

              {/* Label */}
              <text
                y={20}
                textAnchor="middle"
                fill={isActive ? "#fff" : COLORS.textMuted}
                fontSize={11}
                fontWeight={isActive ? 700 : 500}
                letterSpacing={1}
                className="uppercase font-mono"
              >
                {config.label}
              </text>

              {/* Active decorators */}
              {isActive && (
                <g>
                  <circle
                    cx={0}
                    cy={0}
                    r={55}
                    fill="none"
                    stroke={config.color}
                    strokeWidth={1}
                    strokeDasharray="2 6"
                    opacity={0.6}
                  >
                    {!isPaused && (
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0"
                        to="360"
                        dur="10s"
                        repeatCount="indefinite"
                      />
                    )}
                  </circle>
                  {/* Mini status indicator */}
                  <rect
                    x={-20}
                    y={35}
                    width={40}
                    height={16}
                    rx={8}
                    fill={`${config.color}20`}
                    stroke={config.color}
                    strokeWidth={1}
                  />
                  <circle cx={-10} cy={43} r={3} fill={config.color}>
                    {!isPaused && (
                      <animate
                        attributeName="opacity"
                        values="1;0.2;1"
                        dur="1s"
                        repeatCount="indefinite"
                      />
                    )}
                  </circle>
                  <text
                    x={2}
                    y={46}
                    fill={config.color}
                    fontSize={8}
                    fontWeight="bold"
                    textAnchor="middle"
                    className="font-mono"
                  >
                    EXEC
                  </text>
                </g>
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
};

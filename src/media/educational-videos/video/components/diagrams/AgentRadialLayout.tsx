import { type FC } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../../core-logic/constants";
import { stagger } from "../../lib/animations";

type AgentRadialLayoutProps = {
  delay?: number;
};

const AGENTS = [
  { num: 1, label: "Constants", color: COLORS.cyan },
  { num: 2, label: "Hook+Platform", color: COLORS.purple },
  { num: 3, label: "Codespace+Wiki", color: COLORS.purple },
  { num: 4, label: "Generate", color: COLORS.amber },
  { num: 5, label: "MCP Tools", color: COLORS.amber },
  { num: 6, label: "BAZDMEG", color: COLORS.amber },
  { num: 7, label: "Agents+End", color: COLORS.amber },
  { num: 8, label: "Assembly", color: COLORS.success },
];

const RADIUS = 300;
const CIRCLE_SIZE = 80;
const CENTER_X = 540;
const CENTER_Y = 540;

function getPosition(index: number, total: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return {
    x: CENTER_X + Math.cos(angle) * RADIUS,
    y: CENTER_Y + Math.sin(angle) * RADIUS,
  };
}

export const AgentRadialLayout: FC<AgentRadialLayoutProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ position: "relative", width: 1080, height: 1080 }}>
      {/* Dependency lines as SVG */}
      <svg width={1080} height={1080} style={{ position: "absolute", top: 0, left: 0 }}>
        {AGENTS.map((agent, i) => {
          const from = getPosition(i, AGENTS.length);
          if (agent.num === 1) {
            // Agent 1 connects to agents 2-7
            return AGENTS.slice(1, 7).map((target, j) => {
              const to = getPosition(j + 1, AGENTS.length);
              const lineOpacity = spring({
                frame: frame - delay - 300 - stagger(i * 6 + j, 5),
                fps,
                config: SPRING_CONFIGS.smooth,
              });
              return (
                <line
                  key={`1-${target.num}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={COLORS.cyan}
                  strokeWidth={2}
                  opacity={Math.max(0, lineOpacity) * 0.5}
                />
              );
            });
          }
          if (agent.num >= 2 && agent.num <= 7) {
            // Agents 2-7 connect to agent 8
            const to = getPosition(7, AGENTS.length);
            const lineOpacity = spring({
              frame: frame - delay - 300 - stagger(i + 6, 5),
              fps,
              config: SPRING_CONFIGS.smooth,
            });
            return (
              <line
                key={`${agent.num}-8`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={COLORS.success}
                strokeWidth={2}
                opacity={Math.max(0, lineOpacity) * 0.5}
              />
            );
          }
          return null;
        })}
      </svg>

      {/* Agent circles */}
      {AGENTS.map((agent, i) => {
        const pos = getPosition(i, AGENTS.length);
        const circleProgress = spring({
          frame: frame - delay - stagger(i, 8),
          fps,
          config: SPRING_CONFIGS.bouncy,
        });

        return (
          <div
            key={agent.num}
            style={{
              position: "absolute",
              left: pos.x - CIRCLE_SIZE / 2,
              top: pos.y - CIRCLE_SIZE / 2,
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              borderRadius: "50%",
              backgroundColor: `${agent.color}20`,
              border: `2px solid ${agent.color}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${circleProgress})`,
              opacity: circleProgress,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: agent.color,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {agent.num}
            </span>
            {/* Label below circle */}
            <div
              style={{
                position: "absolute",
                top: CIRCLE_SIZE + 8,
                whiteSpace: "nowrap",
                fontSize: 14,
                color: COLORS.textSecondary,
                fontFamily: "Inter, sans-serif",
                textAlign: "center",
              }}
            >
              {agent.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

import { type FC, Fragment, useId, useMemo } from "react";
import { COLORS } from "../../lib/constants";
import { clamp, interpolate, seededRandom } from "../../lib/animation-utils";

export type DarwinianTreeCoreProps = {
  generations?: number; // 1-3
  progress: number;
  width?: number;
  height?: number;
  className?: string;
};

type Node = { x: number; y: number };
type Branch = {
  id: string;
  start: Node;
  end: Node;
  generation: number;
  survives: boolean;
  index: number;
  delayOffset: number;
};

// Colors for the new aesthetic
const C_SURVIVE = "#3b82f6"; // Blue 500
const C_FAIL = "#ef4444"; // Red 500
const C_LEARN = "#10b981"; // Emerald 500

function buildTree(generations: number): Branch[] {
  const branches: Branch[] = [];
  let idx = 0;

  // Root node
  const root = { x: 960, y: 900 };
  const gen0End = { x: 960, y: 650 };

  branches.push({
    id: `branch-0`,
    start: root,
    end: gen0End,
    generation: 0,
    survives: true,
    index: idx++,
    delayOffset: 0,
  });

  if (generations >= 1) {
    const nodes = [
      { end: { x: 740, y: 440 }, survives: true },
      { end: { x: 1240, y: 460 }, survives: false },
    ];
    nodes.forEach((n, i) => {
      branches.push({
        id: `branch-1-${i}`,
        start: gen0End,
        end: n.end,
        generation: 1,
        survives: n.survives,
        index: idx++,
        delayOffset: i * 0.05,
      });
    });
  }

  if (generations >= 2) {
    const g1L = { x: 740, y: 440 }; // Survives
    const nodes = [
      { parent: g1L, end: { x: 550, y: 250 }, survives: true },
      { parent: g1L, end: { x: 880, y: 280 }, survives: false },
    ];
    nodes.forEach((n, i) => {
      branches.push({
        id: `branch-2-${i}`,
        start: n.parent,
        end: n.end,
        generation: 2,
        survives: n.survives,
        index: idx++,
        delayOffset: i * 0.05,
      });
    });

    // Previous gen failed node also spawns brief, immediately-failing attempts
    const g1R = { x: 1240, y: 460 }; // Failed
    branches.push({
      id: `branch-2-fail-1`,
      start: g1R,
      end: { x: 1150, y: 350 },
      generation: 2,
      survives: false,
      index: idx++,
      delayOffset: 0.1,
    });
    branches.push({
      id: `branch-2-fail-2`,
      start: g1R,
      end: { x: 1350, y: 360 },
      generation: 2,
      survives: false,
      index: idx++,
      delayOffset: 0.15,
    });
  }

  if (generations >= 3) {
    const g2L = { x: 550, y: 250 }; // Survives
    const nodes = [
      { parent: g2L, end: { x: 420, y: 100 }, survives: true },
      { parent: g2L, end: { x: 680, y: 120 }, survives: false },
      { parent: g2L, end: { x: 520, y: 80 }, survives: false },
    ];
    nodes.forEach((n, i) => {
      branches.push({
        id: `branch-3-${i}`,
        start: n.parent,
        end: n.end,
        generation: 3,
        survives: n.survives,
        index: idx++,
        delayOffset: i * 0.05,
      });
    });
  }

  return branches;
}

// SVG Cubic Bezier Path Generator
function generatePath(start: Node, end: Node): string {
  const midY = start.y - (start.y - end.y) * 0.5;
  return `M ${start.x} ${start.y} C ${start.x} ${midY}, ${end.x} ${midY}, ${end.x} ${end.y}`;
}

export const DarwinianTreeCore: FC<DarwinianTreeCoreProps> = ({
  generations = 3,
  progress,
  width = 1920,
  height = 1080,
  className,
}) => {
  const id = useId();
  const glowId = `tree-glow-${id.replace(/:/g, "")}`;
  const branches = useMemo(() => buildTree(Math.min(3, Math.max(1, generations))), [generations]);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 1920 1080"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{
        background: COLORS.darkBg,
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${glowId}-strong`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="15" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Generative Grid Background */}
        <pattern
          id="hexGrid"
          width="40"
          height="69.282"
          patternUnits="userSpaceOnUse"
          patternTransform="scale(0.5)"
        >
          <path
            d="M 40 17.3205 L 20 5.7735 L 0 17.3205 L 0 40.4145 L 20 51.9615 L 40 40.4145 Z"
            fill="none"
            stroke={COLORS.cyan}
            strokeWidth="1"
            strokeOpacity="0.1"
          />
          <path
            d="M 20 51.9615 L 20 75.0555"
            fill="none"
            stroke={COLORS.cyan}
            strokeWidth="1"
            strokeOpacity="0.1"
          />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#hexGrid)" />

      {/* Database Receptacle */}
      <g transform="translate(960, 950)">
        <rect
          x={-200}
          y={0}
          width={400}
          height={40}
          rx={4}
          fill="rgba(10,15,20,0.8)"
          stroke={C_LEARN}
          strokeWidth="2"
          strokeOpacity={0.4}
        />
        <text
          y={25}
          textAnchor="middle"
          fill={C_LEARN}
          fontSize="14"
          letterSpacing={4}
          fontWeight="bold"
        >
          EXTRACTED KNOWLEDGE BASE
        </text>
        {/* Glow when learning notes arrive */}
        <rect
          x={-200}
          y={0}
          width={400}
          height={40}
          rx={4}
          fill={C_LEARN}
          opacity={clamp(progress - 0.7, 0, 1) * 0.2}
          filter={`url(#${glowId}-strong)`}
        />
      </g>

      <g
        style={{
          transform: "translate(0, 50px) scale(0.9)",
          transformOrigin: "center top",
        }}
      >
        {/* Draw Branches */}
        {branches.map((branch) => {
          // Sequence branch growth
          const startP = branch.generation * 0.15 + branch.delayOffset;
          const growP = clamp((progress - startP) * 4, 0, 1);

          if (growP <= 0) return null;

          const color = branch.survives ? C_SURVIVE : C_FAIL;
          const pathData = generatePath(branch.start, branch.end);

          // If failed, prune and glitch
          const pruneStart = startP + 0.2;
          const isPruned = !branch.survives && progress > pruneStart;
          const pruneP = clamp((progress - pruneStart) * 5, 0, 1);
          const glitchOffset = isPruned ? seededRandom(branch.index * 99) * 10 - 5 : 0;

          const strokeOpacity = branch.survives ? 1 : Math.max(0.1, 1 - pruneP);

          // Flowing data packet
          const dataPacketP = (progress * 5 - startP) % 1;

          // Dash array magic for drawing the curve
          const pathLength = 600; // approximation
          const dashArray = `${pathLength * growP} ${pathLength}`;

          return (
            <Fragment key={branch.id}>
              {/* Base glowing spline */}
              <path
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth={branch.generation === 0 ? 8 : 4 - branch.generation}
                strokeLinecap="round"
                strokeDasharray={dashArray}
                opacity={strokeOpacity}
                filter={`url(#${glowId})`}
                transform={`translate(${glitchOffset}, ${glitchOffset})`}
                style={{ transition: "stroke-opacity 0.2s" }}
              />

              {/* Data packet pulse (only on surviving branches) */}
              {branch.survives && growP > 0.5 && (
                <path
                  d={pathData}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={2}
                  strokeDasharray={`10 ${pathLength}`}
                  strokeDashoffset={-pathLength * dataPacketP}
                  opacity={0.8}
                  filter={`url(#${glowId}-strong)`}
                />
              )}

              {/* Node intersection point */}
              {growP > 0.9 && (
                <circle
                  cx={branch.end.x}
                  cy={branch.end.y}
                  r={branch.survives ? 6 : 4}
                  fill={color}
                  opacity={strokeOpacity}
                  filter={`url(#${glowId})`}
                />
              )}

              {/* Learning Notes generation on failure */}
              {isPruned &&
                Array.from({ length: 4 }).map((_, i) => {
                  const particleDelay = pruneStart + i * 0.05;
                  const particleP = clamp((progress - particleDelay) * 3, 0, 1);
                  if (particleP <= 0 || particleP >= 1) return null;

                  // Particle falls down to knowledge base
                  const startX = branch.end.x + (seededRandom(branch.index * i) * 60 - 30);
                  const startY = branch.end.y;
                  const targetX = 960 + (seededRandom(branch.index * i * 3) * 300 - 150);
                  const targetY = 950; // Receptacle Y

                  // Quadratic curve easing for falling
                  const easeP = particleP * particleP;

                  const px = interpolate(particleP, [0, 1], [startX, targetX]);
                  const py = interpolate(easeP, [0, 1], [startY, targetY]);

                  return (
                    <g key={`particle-${branch.id}-${i}`} transform={`translate(${px}, ${py})`}>
                      <rect
                        x="-4"
                        y="-4"
                        width="8"
                        height="8"
                        rx="2"
                        fill={C_LEARN}
                        filter={`url(#${glowId})`}
                      />
                      <text y="-8" fill={C_LEARN} fontSize="10" textAnchor="middle" opacity="0.8">
                        Δ token
                      </text>
                    </g>
                  );
                })}
            </Fragment>
          );
        })}
      </g>

      {/* Legend */}
      <g transform={`translate(100, 1000)`}>
        <rect x="0" y="0" width="16" height="4" rx="2" fill={C_SURVIVE} />
        <text x={26} y={7} fill={COLORS.textPrimary} fontSize={14} fontWeight="bold">
          Generation Survives
        </text>

        <rect x="250" y="0" width="16" height="4" rx="2" fill={C_FAIL} />
        <text x={276} y={7} fill={COLORS.textPrimary} fontSize={14} fontWeight="bold">
          Compilation Failed
        </text>

        <rect x="480" y="-4" width="12" height="12" rx="3" fill={C_LEARN} />
        <text x={506} y={7} fill={COLORS.textPrimary} fontSize={14} fontWeight="bold">
          Learning Note Extracted
        </text>
      </g>
    </svg>
  );
};

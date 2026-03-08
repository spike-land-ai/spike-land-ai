import { type FC, useId } from "react";
import { COLORS } from "../core-logic/constants";

export type RecursiveZoomCoreProps = {
  depth: number;
  progress: number;
  width?: number;
  height?: number;
  className?: string;
};

// Types of fractal layers we rotate through
type LayerType = "PLAN" | "CODE" | "TERMINAL";

const LAYER_CYCLE: LayerType[] = ["PLAN", "CODE", "TERMINAL"];

// Render a specific sub-UI type
const renderSubUI = (type: LayerType, w: number, h: number) => {
  switch (type) {
    case "PLAN":
      return (
        <g>
          <rect width={w} height={h} fill="rgba(240, 244, 248, 0.95)" />
          <rect x={10} y={10} width={w - 20} height={20} fill="#cbd5e1" rx={2} />
          <rect x={10} y={40} width={w * 0.6} height={6} fill="#94a3b8" rx={1} />
          <rect x={10} y={52} width={w * 0.8} height={6} fill="#94a3b8" rx={1} />
          <rect x={10} y={64} width={w * 0.7} height={6} fill="#94a3b8" rx={1} />
          <rect
            x={10}
            y={80}
            width={w - 20}
            height={h - 90}
            fill="#f8fafc"
            rx={2}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          {/* Checkboxes */}
          <rect x={20} y={90} width={8} height={8} fill="#10b981" rx={1} />
          <rect x={35} y={92} width={w * 0.4} height={4} fill="#64748b" rx={1} />

          <rect
            x={20}
            y={105}
            width={8}
            height={8}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1}
            rx={1}
          />
          <rect x={35} y={107} width={w * 0.5} height={4} fill="#64748b" rx={1} />
        </g>
      );
    case "CODE":
      return (
        <g>
          <rect width={w} height={h} fill="rgba(15, 23, 42, 0.95)" />
          {/* Editor tabs */}
          <rect width={w} height={15} fill="#1e293b" />
          <rect x={10} y={0} width={60} height={15} fill="#0f172a" />
          <text
            x={40}
            y={10}
            fill="#cbd5e1"
            fontSize={5}
            fontFamily="monospace"
            textAnchor="middle"
          >
            agent.ts
          </text>

          {/* Code lines */}
          <rect x={5} y={25} width={w * 0.3} height={3} fill="#c586c0" rx={1} />
          <rect x={5 + w * 0.3 + 5} y={25} width={w * 0.4} height={3} fill="#4fc1ff" rx={1} />

          <rect x={5} y={35} width={w * 0.2} height={3} fill="#569cd6" rx={1} />
          <rect x={5 + w * 0.2 + 5} y={35} width={w * 0.1} height={3} fill="#dcdcaa" rx={1} />
          <rect x={5 + w * 0.3 + 10} y={35} width={w * 0.4} height={3} fill="#ce9178" rx={1} />

          <rect x={15} y={45} width={w * 0.6} height={3} fill="#9cdcfe" rx={1} />
          <rect x={15} y={55} width={w * 0.8} height={3} fill="#d4d4d4" rx={1} />
          <rect x={15} y={65} width={w * 0.5} height={3} fill="#d4d4d4" rx={1} />
          <rect x={15} y={75} width={w * 0.7} height={3} fill="#d4d4d4" rx={1} />

          <rect x={5} y={85} width={w * 0.1} height={3} fill="#569cd6" rx={1} />
        </g>
      );
    case "TERMINAL":
      return (
        <g>
          <rect width={w} height={h} fill="rgba(0, 0, 0, 0.95)" />
          {/* Terminal header */}
          <rect width={w} height={10} fill="#333" />
          <circle cx={6} cy={5} r={2} fill="#ff5f56" />
          <circle cx={12} cy={5} r={2} fill="#ffbd2e" />
          <circle cx={18} cy={5} r={2} fill="#27c93f" />

          {/* Logs */}
          <text x={5} y={25} fill="#10b981" fontSize={6} fontFamily="monospace">
            ➜
          </text>
          <text x={15} y={25} fill="#cbd5e1" fontSize={6} fontFamily="monospace">
            agent start
          </text>

          <text x={5} y={35} fill="#94a3b8" fontSize={5} fontFamily="monospace">
            [info] initializing workspace...
          </text>
          <text x={5} y={45} fill="#94a3b8" fontSize={5} fontFamily="monospace">
            [info] spawning subagent ID-482...
          </text>

          <text x={5} y={60} fill="#f59e0b" fontSize={5} fontFamily="monospace">
            [warn] test failed (assertion)
          </text>
          <text x={5} y={70} fill="#94a3b8" fontSize={5} fontFamily="monospace">
            [info] rewriting module.ts
          </text>
          <text x={5} y={80} fill="#94a3b8" fontSize={5} fontFamily="monospace">
            [info] compiling...
          </text>

          <text x={5} y={95} fill="#10b981" fontSize={5} fontFamily="monospace">
            [success] build complete
          </text>

          <text x={5} y={110} fill="#10b981" fontSize={6} fontFamily="monospace">
            ➜
          </text>
          <rect x={15} y={105} width={4} height={6} fill="#cbd5e1" opacity={0.8} />
        </g>
      );
  }
};

export const RecursiveZoomCore: FC<RecursiveZoomCoreProps> = ({
  depth,
  progress,
  width = 1920,
  height = 1080,
  className,
}) => {
  const id = useId();

  // Continuous zoom math
  // We want to zoom into the center endlessly based on progress.

  const cx = width / 2;
  const cy = height / 2;

  // Base size of a card
  const cardW = 960;
  const cardH = 540;

  // The scale factor between levels
  const scaleRatio = 0.3;

  // How much we've zoomed fundamentally (progress * some multiplier)
  const zoomFactor = progress * depth;

  // This determines which layer is currently the "outermost" visible one
  const currentLevelInt = Math.floor(zoomFactor);
  const currentLevelFrac = zoomFactor - currentLevelInt;

  // Extra scale applied to the whole scene
  const sceneScale = Math.pow(1 / scaleRatio, currentLevelFrac);

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
        <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id="grid" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <path
            d="M 100 0 L 0 0 0 100"
            fill="none"
            stroke={COLORS.cyan}
            strokeOpacity={0.05}
            strokeWidth={1}
          />
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill="url(#grid)" />

      {/*
         We render a stack of scaled layers.
         We need to render enough layers so the inner ones are ready to become the outer ones as we zoom.
         Usually 4-5 layers is enough to fill the screen depth.
      */}
      <g transform={`translate(${cx}, ${cy}) scale(${sceneScale}) translate(${-cx}, ${-cy})`}>
        {Array.from({ length: 6 })
          .map((_, i) => {
            // Absolute index of this layer
            const layerAbsIndex = currentLevelInt + i - 1;
            if (layerAbsIndex < 0) return null; // Don't render negative layers

            const scale = Math.pow(scaleRatio, i - 1);
            const layerType = LAYER_CYCLE[layerAbsIndex % LAYER_CYCLE.length] ?? "CODE";

            // At inner levels, it's just a tiny box. At outer levels, it fills the screen and fades.
            const opacity = i === 0 ? 1 - currentLevelFrac : 1;

            return (
              <g
                key={`layer-${layerAbsIndex}`}
                transform={`translate(${cx}, ${cy}) scale(${scale}) translate(${
                  -cardW / 2
                }, ${-cardH / 2})`}
                opacity={opacity}
              >
                {/* The UI Card */}
                <g filter={`url(#glow-${id})`}>
                  <rect
                    width={cardW}
                    height={cardH}
                    rx={16}
                    fill={COLORS.darkBg}
                    stroke={COLORS.cyan}
                    strokeWidth={4 / scale}
                    strokeOpacity={0.5}
                  />
                </g>

                {/* Clip path for the actual UI content */}
                <clipPath id={`clip-${id}-${layerAbsIndex}`}>
                  <rect width={cardW} height={cardH} rx={16} />
                </clipPath>

                <g clipPath={`url(#clip-${id}-${layerAbsIndex})`}>
                  {/* The inner mock UI content. Note that we render it at full scale
                         and let the outer <g> scale it down. This makes layout easier. */}
                  <g transform={`scale(${cardW / 200})`}>
                    {renderSubUI(layerType, 200, 200 * (cardH / cardW))}
                  </g>
                </g>

                {/* If this is not the deepest level, we need to cut a hole in it where the NEXT level sits.
                      Or since we render back-to-front (deepest first), no hole needed, they just paint over.
                      WAIT: SVG renders back-to-front.
                      If i=0 is outer, it paints FIRST.
                      Then i=1 paints OVER it.
                      So i=0 (outer) MUST have a hole for i=1 to show through.
                      Instead of a hole, we can just render the array reversed!
                  */}
              </g>
            );
          })
          .reverse()}
      </g>

      {/* Decorative HUD overlay */}
      <g transform="translate(160, 160)">
        <rect
          x={0}
          y={0}
          width={280}
          height={120}
          rx={8}
          fill="rgba(10,15,20,0.8)"
          stroke={COLORS.cyan}
          strokeWidth={1}
        />
        <text
          x={20}
          y={40}
          fill={COLORS.textPrimary}
          fontSize={20}
          fontWeight={800}
          letterSpacing={2}
        >
          DEPTH METRICS
        </text>
        <text
          x={20}
          y={70}
          fill={COLORS.textMuted}
          fontSize={14}
          fontFamily="JetBrains Mono, monospace"
        >
          ZOOM SCALE:{" "}
          <tspan fill={COLORS.cyan}>
            {(sceneScale * Math.pow(1 / scaleRatio, currentLevelInt)).toFixed(3)}x
          </tspan>
        </text>
        <text
          x={20}
          y={100}
          fill={COLORS.textMuted}
          fontSize={14}
          fontFamily="JetBrains Mono, monospace"
        >
          CURRENT SEED:{" "}
          <tspan fill={COLORS.cyan}>{LAYER_CYCLE[currentLevelInt % LAYER_CYCLE.length]}</tspan>
        </text>
      </g>
    </svg>
  );
};

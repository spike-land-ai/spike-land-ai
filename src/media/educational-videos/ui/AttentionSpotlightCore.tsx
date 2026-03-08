import { type FC, useId } from "react";
import { COLORS } from "../core-logic/constants";
import { clamp, interpolate, seededRandom } from "../core-logic/animation-utils";

export type AttentionSpotlightCoreProps = {
  tokenCount: number;
  progress: number;
  width?: number;
  height?: number;
  className?: string;
};

// Generics text shapes to look like code/tokens
const TOKEN_CHARS = [
  "{",
  "}",
  "[]",
  "=>",
  "const",
  "def",
  "async",
  "await",
  "()",
  ";",
  "import",
  "from",
  "*",
  "type",
  "interface",
  "null",
  "undefined",
  "return",
  "class",
  "yield",
];

export const AttentionSpotlightCore: FC<AttentionSpotlightCoreProps> = ({
  tokenCount,
  progress,
  width = 1920,
  height = 1080,
  className,
}) => {
  const id = useId();
  const spotlightId = `spotlight-lens-${id.replace(/:/g, "")}`;

  // Spotlight dims as token count increases (attention budget drops)
  // Max intensity at 1 token, falls off exponentially
  const spotlightOpacity = interpolate(
    clamp(tokenCount, 1, 100),
    [1, 10, 50, 100],
    [1, 0.8, 0.4, 0.15],
  );

  // Radius expands as count increases, but clarity drops
  const spotlightRadius = interpolate(
    clamp(tokenCount, 1, 100),
    [1, 50, 100],
    [20, 35, 60], // Percentage of view
  );

  // Generate deterministic tokens filling the field
  const tokens = Array.from({ length: 400 }, (_, i) => {
    // Distribute them relatively evenly but with noise
    const gridX = (i % 25) / 25;
    const gridY = Math.floor(i / 25) / 16;

    // Add noise
    const nx = gridX + (seededRandom(i * 3.1) - 0.5) * 0.05;
    const ny = gridY + (seededRandom(i * 7.2) - 0.5) * 0.05;

    // Determine if this is an "active" token based on the required count
    // Keep active tokens somewhat clustered near center
    const distFromCenter = Math.sqrt(Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.5, 2));
    const distanceRank = Math.floor(distFromCenter * 400); // Rough ranking
    const isActive = distanceRank < tokenCount * 2.5; // Scale mapping to distribution

    return {
      x: nx * width,
      y: ny * height,
      char: TOKEN_CHARS[Math.floor(seededRandom(i * 11) * TOKEN_CHARS.length)],
      opacity: isActive ? 0.8 : 0.15,
      isActive,
      delay: seededRandom(i * 13) * 0.5,
    };
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{
        background: COLORS.darkBg,
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      <defs>
        {/* Soft lens gradient for masking */}
        <radialGradient id={spotlightId} cx="50%" cy="50%" r={`${spotlightRadius}%`}>
          <stop offset="0%" stopColor="white" stopOpacity={spotlightOpacity} />
          <stop offset="40%" stopColor="white" stopOpacity={spotlightOpacity * 0.6} />
          <stop offset="70%" stopColor="white" stopOpacity={spotlightOpacity * 0.1} />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        {/* Glow effect for active tokens */}
        <filter id="cyanGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Mask for the glass effect */}
        <mask id="lensMask">
          <rect x={0} y={0} width={width} height={height} fill={`url(#${spotlightId})`} />
        </mask>
      </defs>

      {/* Grid background */}
      <pattern id="dotGrid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.5" fill={COLORS.textMuted} opacity="0.1" />
      </pattern>
      <rect x="0" y="0" width="100%" height="100%" fill="url(#dotGrid)" />

      {/* Background/Inactive Tokens (unmasked, always visible but dim) */}
      <g opacity={clamp(progress * 2, 0, 1)}>
        {tokens
          .filter((t) => !t.isActive)
          .map((token, i) => (
            <text
              key={`bg-token-${i}`}
              x={token.x}
              y={token.y}
              fill={COLORS.textMuted}
              opacity={0.1}
              fontSize="14"
              textAnchor="middle"
            >
              {token.char}
            </text>
          ))}
      </g>

      {/* The Lens / Spotlight Background visual */}
      <circle
        cx={width / 2}
        cy={height / 2}
        r={(spotlightRadius / 100) * width * 0.8}
        fill={COLORS.cyan}
        opacity={spotlightOpacity * 0.05}
        filter="blur(40px)"
      />

      {/* Active Tokens masked by the Spotlight */}
      <g mask="url(#lensMask)">
        {/* Bright central flare */}
        <circle
          cx={width / 2}
          cy={height / 2}
          r={(spotlightRadius / 100) * width * 0.4}
          fill={COLORS.cyan}
          opacity={spotlightOpacity * 0.2}
          filter="blur(60px)"
        />

        {/* Ring indicating the boundary of attention */}
        <circle
          cx={width / 2}
          cy={height / 2}
          r={(spotlightRadius / 100) * width * 0.6}
          fill="none"
          stroke={COLORS.cyan}
          strokeWidth="1"
          opacity={spotlightOpacity * 0.3}
          strokeDasharray="4 8"
        />

        {/* The active tokens popping under the lens */}
        {tokens
          .filter((t) => t.isActive)
          .map((token, i) => {
            // Entrance logic
            const tokenEntrance = clamp((progress - token.delay) * 3, 0, 1);
            if (tokenEntrance <= 0) return null;

            // As tokens increase, the ones on the edge get dimmer
            const distFromCenter = Math.sqrt(
              Math.pow(token.x - width / 2, 2) + Math.pow(token.y - height / 2, 2),
            );
            const maxDist = (spotlightRadius / 100) * width;
            const falloff = 1 - Math.min(1, distFromCenter / maxDist);

            return (
              <text
                key={`active-token-${i}`}
                x={token.x}
                y={token.y + (1 - tokenEntrance) * 20} // drop in effect
                fill={COLORS.cyan}
                opacity={token.opacity * tokenEntrance * falloff}
                fontSize={14 + tokenEntrance * 4}
                fontWeight="bold"
                textAnchor="middle"
                filter={falloff > 0.5 ? "url(#cyanGlow)" : ""}
                style={{
                  transition: "all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              >
                {token.char}
              </text>
            );
          })}
      </g>

      {/* Information Overlay */}
      <g transform={`translate(${width / 2}, ${height - 120})`} opacity={clamp(progress * 2, 0, 1)}>
        {/* Display Panel */}
        <rect
          x="-180"
          y="-30"
          width="360"
          height="80"
          rx="8"
          fill="rgba(10,15,20,0.8)"
          stroke={COLORS.cyan}
          strokeOpacity="0.3"
          strokeWidth="1"
        />
        <line
          x1="-180"
          y1="10"
          x2="180"
          y2="10"
          stroke={COLORS.cyan}
          strokeOpacity="0.1"
          strokeWidth="1"
        />

        <text
          y="-5"
          fill={COLORS.textMuted}
          fontSize="12"
          textAnchor="middle"
          letterSpacing="0.1em"
          className="uppercase"
        >
          Softmax Attention Budget
        </text>

        <text
          x="-120"
          y="32"
          fill={COLORS.textPrimary}
          fontSize="24"
          fontWeight="bold"
          textAnchor="start"
        >
          {tokenCount}
          <tspan fontSize="12" fill={COLORS.textMuted} dy="-2">
            TOKENS
          </tspan>
        </text>

        <text
          x="120"
          y="32"
          fill={COLORS.cyan}
          opacity={0.5 + spotlightOpacity * 0.5}
          fontSize="24"
          fontWeight="bold"
          textAnchor="end"
        >
          {Math.round(spotlightOpacity * 100)}%
          <tspan fontSize="12" fill={COLORS.textMuted} dy="-2">
            SIGNAL
          </tspan>
        </text>
      </g>
    </svg>
  );
};

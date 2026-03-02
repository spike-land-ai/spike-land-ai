import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, VERITASIUM_COLORS } from "../../lib/constants";
import { bezierPath, fadeIn } from "../../lib/animations";

type SkillMatchingDiagramProps = {
  url?: string;
  delay?: number;
};

type Skill = {
  name: string;
  keywords: string[];
  color: string;
};

const SKILLS: Skill[] = [
  {
    name: "React Editor",
    keywords: ["code", "edit"],
    color: VERITASIUM_COLORS.transpiling,
  },
  {
    name: "AI Chat",
    keywords: ["chat", "ai"],
    color: VERITASIUM_COLORS.generating,
  },
  {
    name: "Deploy",
    keywords: ["deploy", "build"],
    color: VERITASIUM_COLORS.published,
  },
  {
    name: "Auth",
    keywords: ["login", "auth"],
    color: VERITASIUM_COLORS.planning,
  },
  {
    name: "Database",
    keywords: ["data", "db"],
    color: VERITASIUM_COLORS.fixing,
  },
  {
    name: "Testing",
    keywords: ["test", "spec"],
    color: VERITASIUM_COLORS.learning,
  },
  {
    name: "Docs",
    keywords: ["doc", "help"],
    color: VERITASIUM_COLORS.bayesian,
  },
  {
    name: "Analytics",
    keywords: ["metric", "log"],
    color: VERITASIUM_COLORS.candidate,
  },
];

const GRID_COLS = 4;
const GRID_START_X = 160;
const GRID_START_Y = 280;
const CELL_W = 180;
const CELL_H = 70;
const CELL_GAP_X = 20;
const CELL_GAP_Y = 20;

function extractKeywords(url: string): string[] {
  return url
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .split(/[/\-_.?&=#+]/)
    .filter((k) => k.length > 2);
}

export const SkillMatchingDiagram: FC<SkillMatchingDiagramProps> = ({
  url = "https://spike.land/code/edit/ai-chat",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const urlKeywords = extractKeywords(url);

  // Determine which skills match
  const matchingIndices = SKILLS.map((skill, i) => ({
    index: i,
    matched: skill.keywords.some((kw) =>
      urlKeywords.some((uk) => uk.includes(kw) || kw.includes(uk)),
    ),
  }));

  // URL bar animation
  const urlOpacity = fadeIn(frame, fps, 0.4, delay);

  // Keywords split animation
  const keywordDelay = delay + 15;
  const keywordProgress = spring({
    frame: frame - keywordDelay,
    fps,
    config: SPRING_CONFIGS.snappy,
  });

  // Unique matched keywords for display
  const displayTokens = urlKeywords.filter((kw) =>
    SKILLS.some((s) => s.keywords.some((sk) => kw.includes(sk) || sk.includes(kw))),
  );

  return (
    <div style={{ position: "relative", width: 960, height: 500 }}>
      {/* URL bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 80,
          right: 80,
          height: 52,
          borderRadius: 26,
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${COLORS.darkBorder}`,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 10,
          opacity: urlOpacity,
        }}
      >
        {/* Lock icon */}
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            border: `2px solid ${COLORS.success}`,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -6,
              left: 1,
              width: 8,
              height: 6,
              borderRadius: "4px 4px 0 0",
              border: `2px solid ${COLORS.success}`,
              borderBottom: "none",
            }}
          />
        </div>
        <span
          style={{
            fontSize: 16,
            color: COLORS.textSecondary,
            fontFamily: "JetBrains Mono, monospace",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          {url}
        </span>
      </div>

      {/* Keyword tokens */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 80,
          right: 80,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
          opacity: keywordProgress,
          transform: `translateY(${(1 - keywordProgress) * 10}px)`,
        }}
      >
        {urlKeywords.map((kw, i) => {
          const isMatch = displayTokens.includes(kw);
          const matchedSkill = isMatch
            ? SKILLS.find((s) => s.keywords.some((sk) => kw.includes(sk) || sk.includes(kw)))
            : null;
          const color = matchedSkill ? matchedSkill.color : COLORS.textMuted;

          return (
            <div
              key={`${kw}-${i}`}
              style={{
                padding: "4px 14px",
                borderRadius: 8,
                background: isMatch ? `${color}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isMatch ? `${color}60` : COLORS.darkBorder}`,
                fontSize: 14,
                fontWeight: 600,
                color: isMatch ? color : COLORS.textMuted,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {kw}
            </div>
          );
        })}
      </div>

      {/* SVG connection paths */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter id="pathGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {matchingIndices
          .filter((m) => m.matched)
          .map(({ index }) => {
            const col = index % GRID_COLS;
            const row = Math.floor(index / GRID_COLS);
            const targetX = GRID_START_X + col * (CELL_W + CELL_GAP_X) + CELL_W / 2;
            const targetY = GRID_START_Y + row * (CELL_H + CELL_GAP_Y);
            const sourceX = 480;
            const sourceY = 130;

            const pathDelay = delay + 25 + index * 4;
            const pathProgress = interpolate(frame, [pathDelay, pathDelay + 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            // Sample points along the bezier
            const p0 = { x: sourceX, y: sourceY };
            const p1 = { x: sourceX, y: sourceY + 60 };
            const p2 = { x: targetX, y: targetY - 60 };
            const p3 = { x: targetX, y: targetY };

            const points: string[] = [];
            const steps = Math.floor(pathProgress * 30);
            for (let s = 0; s <= steps; s++) {
              const t = s / 30;
              const pt = bezierPath(t, p0, p1, p2, p3);
              points.push(`${pt.x},${pt.y}`);
            }

            if (points.length < 2) return null;

            return (
              <polyline
                key={`path-${index}`}
                points={points.join(" ")}
                fill="none"
                stroke={SKILLS[index]!.color}
                strokeWidth={2}
                opacity={pathProgress * 0.7}
                filter="url(#pathGlow)"
              />
            );
          })}
      </svg>

      {/* Skill cards grid */}
      {SKILLS.map((skill, i) => {
        const col = i % GRID_COLS;
        const row = Math.floor(i / GRID_COLS);
        const cardDelay = delay + 15 + i * 3;
        const cardProgress = spring({
          frame: frame - cardDelay,
          fps,
          config: SPRING_CONFIGS.snappy,
        });

        const isMatched = matchingIndices[i]!.matched;
        const matchFadeDelay = delay + 35;
        const matchFade = interpolate(
          frame,
          [matchFadeDelay, matchFadeDelay + 15],
          [1, isMatched ? 1 : 0.3],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <div
            key={skill.name}
            style={{
              position: "absolute",
              left: GRID_START_X + col * (CELL_W + CELL_GAP_X),
              top: GRID_START_Y + row * (CELL_H + CELL_GAP_Y),
              width: CELL_W,
              height: CELL_H,
              borderRadius: 14,
              background: isMatched ? `${skill.color}15` : "rgba(255,255,255,0.03)",
              border: `1px solid ${isMatched ? `${skill.color}60` : COLORS.darkBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 600,
              color: isMatched ? skill.color : COLORS.textSecondary,
              fontFamily: "Inter, sans-serif",
              transform: `scale(${cardProgress})`,
              opacity: matchFade,
              boxShadow: isMatched ? `0 0 20px ${skill.color}25` : "none",
            }}
          >
            {skill.name}
          </div>
        );
      })}
    </div>
  );
};

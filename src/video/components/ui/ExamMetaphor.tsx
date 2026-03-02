import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";
import { springScale } from "../../lib/animations";

type ExamMetaphorProps = {
  delay?: number;
  showMemoryWipe?: boolean;
};

// Phase timing (in frames from delay)
const PHASE_GAP = 25;
const PHASE_1_START = 0;
const PHASE_2_START = PHASE_1_START + PHASE_GAP;
const PHASE_3_START = PHASE_2_START + PHASE_GAP;
const PHASE_4_START = PHASE_3_START + PHASE_GAP;
const PHASE_5_START = PHASE_4_START + 30;

const StudentIcon: FC<{ color: string }> = ({ color }) => (
  <svg width={120} height={120} viewBox="0 0 120 120" fill="none">
    {/* Head */}
    <circle cx={60} cy={36} r={18} stroke={color} strokeWidth={3} fill="none" />
    {/* Body */}
    <path
      d="M36 90 C36 66 84 66 84 90"
      stroke={color}
      strokeWidth={3}
      fill="none"
      strokeLinecap="round"
    />
    {/* Arms */}
    <line x1={36} y1={76} x2={24} y2={90} stroke={color} strokeWidth={3} strokeLinecap="round" />
    <line x1={84} y1={76} x2={96} y2={90} stroke={color} strokeWidth={3} strokeLinecap="round" />
  </svg>
);

const ExamPaperIcon: FC<{ color: string }> = ({ color }) => (
  <svg width={100} height={120} viewBox="0 0 100 120" fill="none">
    {/* Paper */}
    <rect
      x={10}
      y={10}
      width={80}
      height={100}
      rx={4}
      stroke={color}
      strokeWidth={2.5}
      fill="none"
    />
    {/* Lines */}
    <line x1={24} y1={34} x2={76} y2={34} stroke={color} strokeWidth={2} opacity={0.5} />
    <line x1={24} y1={50} x2={76} y2={50} stroke={color} strokeWidth={2} opacity={0.5} />
    <line x1={24} y1={66} x2={76} y2={66} stroke={color} strokeWidth={2} opacity={0.5} />
    <line x1={24} y1={82} x2={56} y2={82} stroke={color} strokeWidth={2} opacity={0.5} />
    {/* Grade area */}
    <circle cx={68} cy={24} r={8} stroke={color} strokeWidth={1.5} opacity={0.3} fill="none" />
  </svg>
);

const RedX: FC<{ size?: number }> = ({ size = 80 }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none">
    <line
      x1={16}
      y1={16}
      x2={64}
      y2={64}
      stroke={COLORS.error}
      strokeWidth={8}
      strokeLinecap="round"
    />
    <line
      x1={64}
      y1={16}
      x2={16}
      y2={64}
      stroke={COLORS.error}
      strokeWidth={8}
      strokeLinecap="round"
    />
  </svg>
);

export const ExamMetaphor: FC<ExamMetaphorProps> = ({ delay = 0, showMemoryWipe = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - delay;

  // Phase 1: Student appears
  const studentScale = springScale(frame, fps, SPRING_CONFIGS.snappy, delay + PHASE_1_START);

  // Phase 2: Exam paper slides in
  const examProgress = spring({
    frame: localFrame - PHASE_2_START,
    fps,
    config: SPRING_CONFIGS.snappy,
  });
  const examX = interpolate(examProgress, [0, 1], [200, 0]);
  const examOpacity = interpolate(examProgress, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Phase 3: Red X
  const xScale = springScale(frame, fps, SPRING_CONFIGS.bouncy, delay + PHASE_3_START);

  // Phase 4: Memory wipe sweep
  const wipeProgress = showMemoryWipe
    ? interpolate(localFrame, [PHASE_4_START, PHASE_4_START + 20], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  // Phase 5: Student reappears
  const reappearScale = showMemoryWipe
    ? springScale(frame, fps, SPRING_CONFIGS.snappy, delay + PHASE_5_START)
    : 0;

  // After wipe, hide old elements
  const preWipeOpacity = showMemoryWipe
    ? interpolate(wipeProgress, [0, 0.5], [1, 0], { extrapolateRight: "clamp" })
    : 1;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
        position: "relative",
        width: 800,
        height: 300,
      }}
    >
      {/* Pre-wipe content */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 60,
          opacity: preWipeOpacity,
        }}
      >
        {/* Student */}
        <div style={{ transform: `scale(${studentScale})` }}>
          <StudentIcon color={COLORS.textPrimary} />
        </div>

        {/* Exam paper */}
        <div
          style={{
            position: "relative",
            transform: `translateX(${examX}px)`,
            opacity: examOpacity,
          }}
        >
          <ExamPaperIcon color={COLORS.textSecondary} />
          {/* Red X overlay */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${xScale})`,
            }}
          >
            <RedX />
          </div>
        </div>
      </div>

      {/* Memory wipe sweep line */}
      {showMemoryWipe && wipeProgress > 0 && wipeProgress < 1 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${wipeProgress * 100}%`,
            width: 4,
            height: "100%",
            background: `linear-gradient(180deg, transparent, ${COLORS.cyan}, transparent)`,
            boxShadow: `0 0 20px ${COLORS.cyan}80, 0 0 40px ${COLORS.cyan}40`,
          }}
        />
      )}

      {/* Phase 5: Fresh student reappears */}
      {showMemoryWipe && reappearScale > 0 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) scale(${reappearScale})`,
          }}
        >
          <StudentIcon color={COLORS.cyan} />
        </div>
      )}
    </div>
  );
};

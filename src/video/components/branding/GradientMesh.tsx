import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../../lib/constants";

type GradientMeshProps = {
  animationSpeed?: number;
  opacity?: number;
};

export function GradientMesh({ animationSpeed = 0.02, opacity = 1 }: GradientMeshProps) {
  const frame = useCurrentFrame();

  // Animate gradient positions
  const offset1 = Math.sin(frame * animationSpeed) * 10;
  const offset2 = Math.cos(frame * animationSpeed * 0.7) * 15;
  const offset3 = Math.sin(frame * animationSpeed * 1.3) * 8;

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: `
          radial-gradient(
            ellipse at ${20 + offset1}% ${30 + offset2}%,
            ${COLORS.cyan}25 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse at ${80 + offset2}% ${70 + offset1}%,
            ${COLORS.fuchsia}25 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse at ${50 + offset3}% ${50 - offset3}%,
            ${COLORS.purple}15 0%,
            transparent 60%
          ),
          linear-gradient(
            180deg,
            ${COLORS.darkBg} 0%,
            #0f0f1a 50%,
            ${COLORS.darkBg} 100%
          )
        `,
      }}
    />
  );
}

type AuroraBorealisProps = {
  intensity?: number;
};

export function AuroraBorealis({ intensity = 1 }: AuroraBorealisProps) {
  const frame = useCurrentFrame();

  // Multiple aurora layers with different speeds
  const wave1 = Math.sin(frame * 0.015) * 100;
  const wave2 = Math.cos(frame * 0.02) * 80;
  const wave3 = Math.sin(frame * 0.025) * 60;

  const opacity1 = (Math.sin(frame * 0.01) * 0.15 + 0.2) * intensity;
  const opacity2 = (Math.cos(frame * 0.015) * 0.1 + 0.15) * intensity;

  return (
    <AbsoluteFill>
      {/* Base dark gradient */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${COLORS.darkBg} 0%, #0a0a15 100%)`,
        }}
      />

      {/* Aurora layer 1 - cyan */}
      <AbsoluteFill
        style={{
          opacity: opacity1,
          background: `
            radial-gradient(
              ellipse 150% 50% at ${50 + wave1 * 0.3}% -10%,
              ${COLORS.cyan}60 0%,
              transparent 70%
            )
          `,
          filter: "blur(40px)",
        }}
      />

      {/* Aurora layer 2 - fuchsia */}
      <AbsoluteFill
        style={{
          opacity: opacity2,
          background: `
            radial-gradient(
              ellipse 120% 40% at ${50 + wave2 * 0.2}% 5%,
              ${COLORS.fuchsia}50 0%,
              transparent 60%
            )
          `,
          filter: "blur(50px)",
        }}
      />

      {/* Aurora layer 3 - purple */}
      <AbsoluteFill
        style={{
          opacity: opacity1 * 0.7,
          background: `
            radial-gradient(
              ellipse 100% 30% at ${50 + wave3 * 0.25}% 0%,
              ${COLORS.purple}40 0%,
              transparent 50%
            )
          `,
          filter: "blur(30px)",
        }}
      />

      {/* Stars/particles layer */}
      <ParticleField count={50} />
    </AbsoluteFill>
  );
}

type ParticleFieldProps = {
  count?: number;
};

function ParticleField({ count = 30 }: ParticleFieldProps) {
  const frame = useCurrentFrame();

  // Generate deterministic particle positions
  const particles = Array.from({ length: count }, (_, i) => {
    const seed = i * 7919; // Prime number for better distribution
    const x = (seed * 13) % 100;
    const y = (seed * 17) % 100;
    const size = (seed % 3) + 1;
    const speed = ((seed % 5) + 1) * 0.001;
    const phase = seed % 360;

    return { x, y, size, speed, phase };
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {particles.map((particle, i) => {
        const twinkle = Math.sin(frame * particle.speed * 10 + particle.phase) * 0.5 + 0.5;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              backgroundColor: COLORS.textPrimary,
              opacity: twinkle * 0.8,
              boxShadow: `0 0 ${particle.size * 2}px ${COLORS.textPrimary}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

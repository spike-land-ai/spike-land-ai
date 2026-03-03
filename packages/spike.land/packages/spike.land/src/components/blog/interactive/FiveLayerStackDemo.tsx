"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useState } from "react";
import { useInViewProgress } from "./useInViewProgress";

type LayerConfig = {
  label: string;
  description: string;
  detail: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
  badge: string;
};

function PersonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.77-3.2A2.5 2.5 0 0 1 4 13a2.5 2.5 0 0 1 .5-5 2.5 2.5 0 0 1 5-6z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.77-3.2A2.5 2.5 0 0 0 20 13a2.5 2.5 0 0 0-.5-5 2.5 2.5 0 0 0-5-6z" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

const LAYERS: LayerConfig[] = [
  {
    label: "Identity",
    description: "Who the agent is",
    detail: "Core persona, name, role, and behavioral defaults. Stable across all sessions.",
    color: "#0ea5e9",
    bgColor: "rgba(14,165,233,0.08)",
    borderColor: "rgba(14,165,233,0.4)",
    icon: <PersonIcon />,
    badge: "CONSERVED",
  },
  {
    label: "Knowledge",
    description: "What it knows",
    detail: "Domain expertise, facts, and learned patterns stored in long-term memory.",
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.08)",
    borderColor: "rgba(59,130,246,0.4)",
    icon: <BrainIcon />,
    badge: "CONSERVED",
  },
  {
    label: "Examples",
    description: "How it learned",
    detail: "Few-shot demonstrations and training examples that shape output style.",
    color: "#6366f1",
    bgColor: "rgba(99,102,241,0.08)",
    borderColor: "rgba(99,102,241,0.4)",
    icon: <CodeIcon />,
    badge: "CONSERVED",
  },
  {
    label: "Constraints",
    description: "Rules and guardrails",
    detail: "Safety boundaries, output format rules, and behavioral guardrails for this session.",
    color: "#8b5cf6",
    bgColor: "rgba(139,92,246,0.08)",
    borderColor: "rgba(139,92,246,0.4)",
    icon: <LockIcon />,
    badge: "DYNAMIC",
  },
  {
    label: "Tools",
    description: "What it can do",
    detail: "Available function calls, MCP servers, APIs, and real-time capabilities.",
    color: "#d946ef",
    bgColor: "rgba(217,70,239,0.08)",
    borderColor: "rgba(217,70,239,0.4)",
    icon: <WrenchIcon />,
    badge: "DYNAMIC",
  },
];

type LayerCardProps = {
  layer: LayerConfig;
  index: number;
  totalLayers: number;
  isHovered: boolean;
  anyHovered: boolean;
  onHover: (index: number | null) => void;
  progress: number;
};

function LayerCard({
  layer,
  index,
  totalLayers,
  isHovered,
  anyHovered,
  onHover,
  progress,
}: LayerCardProps) {
  const layerDelay = index * 0.12;
  const normalizedProgress = 1 - layerDelay * 0.7;
  const layerProgress = normalizedProgress > 0
    ? Math.max(0, Math.min(1, (progress - layerDelay) / normalizedProgress))
    : 0;

  const stackDepth = totalLayers - 1 - index;
  const baseOffsetX = stackDepth * 3;

  const liftY = isHovered ? -18 : anyHovered && !isHovered ? 3 : 0;
  const liftX = isHovered ? -3 : 0;
  const liftScale = isHovered ? 1.02 : anyHovered && !isHovered ? 0.99 : 1;

  return (
    <motion.div
      style={{
        position: "relative",
        marginBottom: index < totalLayers - 1 ? "-22px" : "0",
        zIndex: index,
        cursor: "pointer",
      }}
      initial={{ opacity: 0, x: -40 }}
      animate={{
        opacity: layerProgress,
        x: isHovered ? liftX : baseOffsetX * (1 - layerProgress),
        y: liftY,
        scale: liftScale,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onHoverStart={() => onHover(index)}
      onHoverEnd={() => onHover(null)}
    >
      <div
        style={{
          position: "absolute",
          bottom: -5,
          left: 3,
          right: -3,
          height: 8,
          background: `linear-gradient(135deg, ${layer.color}25, transparent)`,
          borderRadius: "0 0 8px 8px",
          filter: "blur(3px)",
          zIndex: -1,
        }}
      />

      <div
        style={{
          background: layer.bgColor,
          border: `1px solid ${layer.borderColor}`,
          borderRadius: 10,
          padding: "13px 18px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          backdropFilter: "blur(8px)",
          boxShadow: isHovered
            ? `0 20px 40px ${layer.color}25, 0 0 0 1px ${layer.color}50, inset 0 1px 0 ${layer.color}30`
            : `0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 ${layer.color}15`,
          transition: "box-shadow 0.2s ease",
          position: "relative",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(135deg, ${layer.color}10 0%, transparent 60%)`,
                pointerEvents: "none",
              }}
            />
          )}
        </AnimatePresence>

        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: `${layer.color}18`,
            border: `1px solid ${layer.color}35`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: layer.color,
            flexShrink: 0,
            boxShadow: isHovered ? `0 0 14px ${layer.color}45` : "none",
            transition: "box-shadow 0.2s",
          }}
        >
          {layer.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                color: layer.color,
                fontSize: 14,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontFamily: "Inter, sans-serif",
                textShadow: isHovered ? `0 0 10px ${layer.color}70` : "none",
              }}
            >
              {layer.label}
            </span>
            <span
              style={{
                padding: "2px 7px",
                background: `${layer.color}12`,
                border: `1px solid ${layer.color}35`,
                color: layer.color,
                fontSize: 9,
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: "bold",
                borderRadius: 4,
                letterSpacing: "0.12em",
              }}
            >
              {layer.badge}
            </span>
          </div>
          <div
            style={{
              color: "rgba(148,163,184,0.85)",
              fontSize: 12,
              fontFamily: "JetBrains Mono, monospace",
              marginTop: 3,
            }}
          >
            {layer.description}
          </div>
        </div>

        <div
          style={{
            color: `${layer.color}55`,
            fontSize: 10,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: "bold",
            flexShrink: 0,
          }}
        >
          L{index + 1}
        </div>
      </div>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: "calc(100% + 14px)",
              top: "50%",
              transform: "translateY(-50%)",
              width: 210,
              background: "rgba(8,12,22,0.96)",
              border: `1px solid ${layer.color}45`,
              borderRadius: 10,
              padding: "11px 14px",
              zIndex: 100,
              boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${layer.color}25`,
              backdropFilter: "blur(12px)",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -7,
                top: "50%",
                transform: "translateY(-50%) rotate(45deg)",
                width: 12,
                height: 12,
                background: "rgba(8,12,22,0.96)",
                border: `1px solid ${layer.color}45`,
                borderRight: "none",
                borderTop: "none",
              }}
            />
            <div
              style={{
                color: layer.color,
                fontSize: 10,
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: "bold",
                letterSpacing: "0.1em",
                marginBottom: 5,
                textTransform: "uppercase",
              }}
            >
              {layer.label}
            </div>
            <div
              style={{
                color: "rgba(148,163,184,0.9)",
                fontSize: 12,
                lineHeight: 1.6,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {layer.detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type KvBoundaryProps = {
  progress: number;
};

function KvCacheBoundary({ progress }: KvBoundaryProps) {
  const opacity = Math.max(0, Math.min(1, (progress - 0.55) * 3));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        maxWidth: 500,
        margin: "10px auto",
        opacity,
        padding: "0 6px",
        transition: "opacity 0.4s ease",
      }}
    >
      <div
        style={{
          flex: 1,
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(14,165,233,0.45))",
        }}
      />
      <div
        style={{
          padding: "3px 10px",
          background: "rgba(14,165,233,0.07)",
          border: "1px solid rgba(14,165,233,0.25)",
          borderRadius: 4,
          color: "rgba(14,165,233,0.85)",
          fontSize: 9,
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: "bold",
          letterSpacing: "0.13em",
          whiteSpace: "nowrap",
          boxShadow: "0 0 10px rgba(14,165,233,0.15)",
        }}
      >
        KV CACHE BOUNDARY · 10X COST REDUCTION
      </div>
      <div
        style={{
          flex: 1,
          height: 1,
          background: "linear-gradient(90deg, rgba(14,165,233,0.45), transparent)",
        }}
      />
    </div>
  );
}

type InteractiveStackProps = {
  progress: number;
};

function InteractiveStack({ progress }: InteractiveStackProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const anyHovered = hoveredIndex !== null;
  const totalLayers = LAYERS.length;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 500,
        margin: "0 auto",
        padding: "6px 52px 6px 6px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column-reverse" }}>
        {LAYERS.map((layer, index) => (
          <LayerCard
            key={layer.label}
            layer={layer}
            index={index}
            totalLayers={totalLayers}
            isHovered={hoveredIndex === index}
            anyHovered={anyHovered}
            onHover={setHoveredIndex}
            progress={progress}
          />
        ))}
      </div>
    </div>
  );
}

export function FiveLayerStackDemo() {
  const { ref, progress } = useInViewProgress();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-150, 150], [3, -3]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(mouseX, [-150, 150], [-3, 3]), {
    stiffness: 300,
    damping: 30,
  });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    mouseX.set(e.clientX - cx);
    mouseY.set(e.clientY - cy);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <div
      ref={ref}
      className="my-8 flex flex-col items-center py-12 px-4 rounded-xl shadow-2xl shadow-cyan-900/10 border border-slate-800 bg-slate-950 relative overflow-hidden group"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.1),transparent_50%)] pointer-events-none" />
      <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-fuchsia-500/10 blur-3xl pointer-events-none" />

      <div className="text-center relative z-10 mb-8 max-w-lg w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-cyan-950/50 border border-cyan-800 text-cyan-400 text-[10px] font-bold mb-5 tracking-[0.2em] font-mono shadow-[0_0_15px_rgba(34,211,238,0.15)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          SYSTEM ARCHITECTURE
        </div>
        <p className="text-sm font-light text-slate-300 mx-auto leading-relaxed">
          The 5-layer context stack structures the agent&apos;s attention. Conserved layers form the
          cached identity. Dynamic layers inject the reality of the current request.
        </p>
      </div>

      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d", width: "100%" }}
        className="relative z-10"
      >
        <div className="hidden md:block">
          <InteractiveStack progress={progress} />
          <KvCacheBoundary progress={progress} />
        </div>

        <div className="md:hidden">
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              margin: "0 auto",
              padding: "6px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {LAYERS.map((layer, index) => {
              const layerDelay = index * 0.12;
              const normalizedProgress = 1 - layerDelay * 0.7;
              const layerProgress = normalizedProgress > 0
                ? Math.max(0, Math.min(1, (progress - layerDelay) / normalizedProgress))
                : 0;

              return (
                <motion.div
                  key={layer.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: layerProgress, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{
                    background: layer.bgColor,
                    border: `1px solid ${layer.borderColor}`,
                    borderRadius: 10,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: `${layer.color}18`,
                      border: `1px solid ${layer.color}35`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: layer.color,
                      flexShrink: 0,
                    }}
                  >
                    {layer.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                    >
                      <span
                        style={{
                          color: layer.color,
                          fontSize: 13,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {layer.label}
                      </span>
                      <span
                        style={{
                          padding: "1px 6px",
                          background: `${layer.color}12`,
                          border: `1px solid ${layer.color}35`,
                          color: layer.color,
                          fontSize: 8,
                          fontWeight: "bold",
                          borderRadius: 3,
                          letterSpacing: "0.1em",
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        {layer.badge}
                      </span>
                    </div>
                    <div
                      style={{
                        color: "rgba(148,163,184,0.8)",
                        fontSize: 11,
                        fontFamily: "JetBrains Mono, monospace",
                        marginTop: 2,
                      }}
                    >
                      {layer.description}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-6 relative z-10">
        {progress < 0.3 ? "Scroll to initialize layers" : "Hover layers to inspect"}
      </p>
    </div>
  );
}

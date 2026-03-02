import { type FC, Fragment } from "react";
import { COLORS } from "../../lib/constants";

export type FiveLayerStackCoreProps = {
  revealCount: number;
  progress: number; // 0-1 for the whole stack entrance
  className?: string;
};

// Cybernetic, editorial color palette for layers
const LAYERS = [
  {
    label: "Identity",
    description: "Who the agent is",
    color: "#0ea5e9", // Sky 500
    group: "conserved" as const,
  },
  {
    label: "Knowledge",
    description: "What it knows",
    color: "#3b82f6", // Blue 500
    group: "conserved" as const,
  },
  {
    label: "Examples",
    description: "How it learned",
    color: "#6366f1", // Indigo 500
    group: "conserved" as const,
  },
  {
    label: "Constraints",
    description: "Rules & guardrails",
    color: "#8b5cf6", // Violet 500
    group: "dynamic" as const,
  },
  {
    label: "Tools",
    description: "What it can do",
    color: "#d946ef", // Fuchsia 500
    group: "dynamic" as const,
  },
];

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

export const FiveLayerStackCore: FC<FiveLayerStackCoreProps> = ({
  revealCount,
  progress,
  className,
}) => {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        height: 600, // Fixed height for the isometric stack
        perspective: 1200,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Background isometric grid */}
      <div
        style={{
          position: "absolute",
          inset: -200,
          backgroundImage: `
              linear-gradient(rgba(14, 165, 233, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(14, 165, 233, 0.1) 1px, transparent 1px)
           `,
          backgroundSize: "40px 40px",
          transform: "rotateX(60deg) rotateZ(-45deg) translateY(100px)",
          transformOrigin: "center center",
          opacity: clamp(progress * 2, 0, 1),
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Central "Context Beam" piercing the layers */}
      <div
        style={{
          position: "absolute",
          width: 4,
          height: "80%",
          background: "linear-gradient(to bottom, transparent, #0ea5e9, #d946ef, transparent)",
          boxShadow: "0 0 20px #0ea5e9, 0 0 40px #d946ef",
          left: "50%",
          transform: "translateX(-50%)",
          opacity: clamp((progress - 0.5) * 2, 0, 1),
          zIndex: 5,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Layers render bottom-to-top visually */}
        {[...LAYERS].reverse().map((layer, reversedIndex) => {
          const layerIndex = LAYERS.length - 1 - reversedIndex;
          if (layerIndex >= revealCount) return null;

          // Progress for this specific layer
          const layerProgress = clamp(progress * 2.5 - layerIndex * 0.2, 0, 1);

          const isConserved = layer.group === "conserved";
          const badgeLabel = isConserved ? "CONSERVED" : "DYNAMIC";

          // Isometric math
          const translateY = -120 + layerIndex * 60; // Spread vertically
          // Fall in from above
          const dropY = (1 - layerProgress) * -200;

          return (
            <Fragment key={layer.label}>
              {/* Layer container (handles 3D positioning) */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 320,
                  height: 180,
                  transform: `translate(-50%, -50%) translateY(${
                    translateY + dropY
                  }px) rotateX(60deg) rotateZ(-45deg)`,
                  opacity: layerProgress,
                  transition: "all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              >
                {/* The glass slab */}
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: `linear-gradient(135deg, ${layer.color}15, ${layer.color}05)`,
                    backdropFilter: "blur(8px)",
                    borderTop: `1px solid ${layer.color}80`,
                    borderLeft: `1px solid ${layer.color}80`,
                    borderRight: `1px solid ${layer.color}20`,
                    borderBottom: `1px solid ${layer.color}20`,
                    boxShadow: `
                        -10px 10px 20px rgba(0,0,0,0.5),
                        inset 2px 2px 10px ${layer.color}20
                     `,
                    position: "relative",
                    // Subtle pulse on hover could go here in a real app
                  }}
                >
                  {/* Depth extrusion (simulating 3D thickness) */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: -10,
                      left: -1,
                      width: "100%",
                      height: 10,
                      background: `linear-gradient(to right, ${layer.color}40, ${layer.color}10)`,
                      transform: "skewX(-45deg)",
                      transformOrigin: "top left",
                      borderLeft: `1px solid ${layer.color}60`,
                      borderBottom: `1px solid ${layer.color}20`,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: -1,
                      right: -10,
                      width: 10,
                      height: "100%",
                      background: `linear-gradient(to bottom, ${layer.color}20, transparent)`,
                      transform: "skewY(-45deg)",
                      transformOrigin: "top left",
                      borderRight: `1px solid ${layer.color}20`,
                    }}
                  />

                  {/* Grid lines on the slab */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `
                         linear-gradient(${layer.color}20 1px, transparent 1px),
                         linear-gradient(90deg, ${layer.color}20 1px, transparent 1px)
                      `,
                      backgroundSize: "20px 20px",
                      opacity: 0.5,
                    }}
                  />
                </div>
              </div>

              {/* Holographic Label (floating next to the slab, not skewed) */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  // Match the visual height of the slab but offset horizontally
                  transform: `translate(120px, ${translateY + dropY - 20}px)`,
                  opacity: layerProgress,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                }}
              >
                {/* Connecting dashed line */}
                <div
                  style={{
                    position: "absolute",
                    right: "100%",
                    top: 24,
                    width: 60,
                    borderBottom: `1px dashed ${layer.color}60`,
                  }}
                />

                <div
                  style={{
                    color: layer.color,
                    fontSize: 24,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    textShadow: `0 0 10px ${layer.color}80`,
                  }}
                >
                  {layer.label}
                </div>
                <div
                  style={{
                    color: COLORS.textMuted,
                    fontSize: 13,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  // {layer.description}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    padding: "2px 8px",
                    background: `${layer.color}15`,
                    border: `1px solid ${layer.color}40`,
                    color: layer.color,
                    fontSize: 10,
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: "bold",
                  }}
                >
                  {badgeLabel}
                </div>
              </div>
            </Fragment>
          );
        })}

        {/* KV Cache separator line (shows between conserved and dynamic) */}
        {revealCount > 3 && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) translateY(20px)`, // Positioned between layer 2 and 3
              width: 500,
              display: "flex",
              alignItems: "center",
              gap: 16,
              opacity: Math.max(0, clamp((progress - 0.7) * 4, 0, 1)),
              zIndex: 20,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 1,
                background: `linear-gradient(90deg, transparent, ${COLORS.cyan}, transparent)`,
              }}
            />
            <div
              style={{
                color: COLORS.cyan,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11,
                background: "rgba(10,15,20,0.8)",
                padding: "4px 12px",
                border: `1px solid ${COLORS.cyan}40`,
                boxShadow: `0 0 10px ${COLORS.cyan}40`,
              }}
            >
              KV CACHE BOUNDARY / 10X COST REDUCTION
            </div>
            <div
              style={{
                flex: 1,
                height: 1,
                background: `linear-gradient(90deg, transparent, ${COLORS.cyan}, transparent)`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

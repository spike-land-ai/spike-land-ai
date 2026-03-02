"use client";
import { animated, useSpring } from "@react-spring/three";
import { Html } from "@react-three/drei";
import { memo, useMemo } from "react";
import { useCardGestures } from "../../hooks/useCardGestures";
import type { Card as CardType, Suit } from "../../types/card";

interface CardProps {
  card: CardType;
  isOwner: boolean;
  onMove: (id: string, pos: { x: number; y: number; z: number }) => void;
  onFlip: (id: string) => void;
  onGrab?: ((id: string) => void) | undefined;
  onRelease?: ((id: string) => void) | undefined;
}

// Suit info lookup table (static, no function call needed)
const SUIT_INFO: Record<Suit, { symbol: string; color: string }> = {
  hearts: { symbol: "♥", color: "#e53935" },
  diamonds: { symbol: "♦", color: "#e53935" },
  clubs: { symbol: "♣", color: "#212121" },
  spades: { symbol: "♠", color: "#212121" },
};

// Memoized card face component to reduce re-renders
const CardFace = memo(function CardFace({
  rank,
  suit,
  color,
}: {
  rank: string;
  suit: string;
  color: string;
}) {
  return (
    <div
      style={{
        fontSize: "24px",
        fontWeight: "bold",
        fontFamily: "serif",
        color,
        textAlign: "center",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ fontSize: "32px" }}>{rank}</div>
      <div style={{ fontSize: "28px" }}>{suit}</div>
    </div>
  );
});

// Memoized card back component with ornate pattern
const CardBack = memo(function CardBack() {
  return (
    <div
      style={{
        width: "60px",
        height: "85px",
        borderRadius: "4px",
        border: "2px solid #ffd700",
        background: `
          linear-gradient(135deg, #8B0000 25%, transparent 25%),
          linear-gradient(225deg, #8B0000 25%, transparent 25%),
          linear-gradient(45deg, #8B0000 25%, transparent 25%),
          linear-gradient(315deg, #8B0000 25%, transparent 25%),
          linear-gradient(to bottom, #6B0000, #8B0000, #6B0000)
        `,
        backgroundSize: "10px 10px, 10px 10px, 10px 10px, 10px 10px, 100% 100%",
        backgroundPosition: "0 0, 5px 0, 5px -5px, 0 5px, 0 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "inset 0 0 10px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "60px",
          border: "1px solid #ffd700",
          borderRadius: "2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse, #8B0000 0%, #5B0000 100%)",
        }}
      >
        <span
          style={{
            fontSize: "20px",
            color: "#ffd700",
            textShadow: "0 0 4px rgba(255, 215, 0, 0.5)",
          }}
        >
          ✦
        </span>
      </div>
    </div>
  );
});

// Memoized nameplate component for grabbed objects
const GrabbedNameplate = memo(function GrabbedNameplate({
  playerName,
  playerColor,
}: {
  playerName: string;
  playerColor: string;
}) {
  return (
    <div
      style={{
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(4px)",
        padding: "4px 10px",
        borderRadius: "8px",
        border: `2px solid ${playerColor}`,
        boxShadow: `0 0 12px ${playerColor}`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          color: playerColor,
          fontSize: "11px",
          fontWeight: 600,
          textShadow: `0 0 8px ${playerColor}`,
        }}
      >
        {playerName}
      </span>
    </div>
  );
});

export function Card({ card, isOwner, onMove, onFlip, onGrab, onRelease }: CardProps) {
  // Animate position and rotation with optimized config
  const { position, rotation } = useSpring({
    position: [card.position.x, card.position.y, card.position.z],
    rotation: [card.rotation.x, card.rotation.y, card.rotation.z],
    config: { friction: 50, tension: 120, precision: 0.01 },
  });

  const bind = useCardGestures(card.id, onMove, onFlip, onGrab, onRelease);
  const gestureHandlers = bind();

  const showFace = card.faceUp || isOwner;
  const suitInfo = SUIT_INFO[card.suit];
  const isGrabbed = !!card.grabbedBy;
  const grabberColor = card.grabbedBy?.playerColor ?? "#3B82F6";

  // Memoize static Html props to prevent re-creation
  const htmlProps = useMemo(
    () => ({
      position: [0, 0, 0.03] as [number, number, number],
      center: true,
      distanceFactor: 8,
      style: { pointerEvents: "none" as const },
      occlude: false,
      transform: true,
    }),
    [],
  );

  // Nameplate Html props - positioned above the card
  const nameplateProps = useMemo(
    () => ({
      position: [0, 2.5, 0] as [number, number, number],
      center: true,
      distanceFactor: 10,
      style: { pointerEvents: "none" as const },
      occlude: false,
      transform: true,
    }),
    [],
  );

  return (
    <animated.group
      position={position as unknown as [number, number, number]}
      rotation={rotation as unknown as [number, number, number]}
      {...(gestureHandlers as Record<string, unknown>)}
    >
      {/* Glow effect handled by emissive material on the card mesh itself now */}

      <mesh castShadow receiveShadow>
        {/* Thinner card geometry */}
        <boxGeometry args={[2.5, 3.5, 0.01]} />
        {/* Card sides - pure white cardboard look */}
        <meshStandardMaterial attach="material-0" color={isGrabbed ? grabberColor : "#f5f5f5"} />
        <meshStandardMaterial attach="material-1" color={isGrabbed ? grabberColor : "#f5f5f5"} />
        <meshStandardMaterial attach="material-2" color={isGrabbed ? grabberColor : "#f5f5f5"} />
        <meshStandardMaterial attach="material-3" color={isGrabbed ? grabberColor : "#f5f5f5"} />
        {/* Front face - slightly warm white paper */}
        <meshStandardMaterial
          attach="material-4"
          color={showFace ? "#fafafa" : "#ffffff"}
          emissive={isGrabbed ? grabberColor : "#000000"}
          emissiveIntensity={isGrabbed ? 0.15 : 0}
          roughness={0.5}
        />
        {/* Back face - solid color or pattern base */}
        <meshStandardMaterial
          attach="material-5"
          color="#880000"
          emissive={isGrabbed ? grabberColor : "#000000"}
          emissiveIntensity={isGrabbed ? 0.15 : 0}
          roughness={0.6}
        />
      </mesh>

      {/* Card face label - only show if face up or owner */}
      {showFace && (
        <Html {...htmlProps}>
          <CardFace rank={card.rank} suit={suitInfo.symbol} color={suitInfo.color} />
        </Html>
      )}

      {/* Back pattern - show when face down */}
      {!showFace && (
        <Html {...htmlProps}>
          <CardBack />
        </Html>
      )}

      {/* Nameplate - show when grabbed by another player */}
      {isGrabbed && card.grabbedBy && (
        <Html {...nameplateProps}>
          <GrabbedNameplate
            playerName={card.grabbedBy.playerName}
            playerColor={card.grabbedBy.playerColor}
          />
        </Html>
      )}
    </animated.group>
  );
}

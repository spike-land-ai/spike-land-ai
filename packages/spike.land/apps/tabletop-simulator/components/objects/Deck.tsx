"use client";

interface DeckProps {
  count: number;
  onDraw: () => void;
  onShuffle: () => void;
}

export function Deck({ count, onDraw, onShuffle }: DeckProps) {
  // Stack height grows with card count (capped at 0.5 max visual height)
  const stackHeight = Math.min(0.5, Math.max(0.05, count * 0.002));

  return (
    // Move deck to the side (-4 on X) to clear center table area
    <group position={[-4, 0.05, 0]}>
      {count > 0 && (
        <group
          onClick={onDraw}
          onContextMenu={(e) => {
            e.stopPropagation();
            onShuffle();
          }}
        >
          {/* Main stack body (sides are white to look like paper stack) */}
          <mesh castShadow receiveShadow position={[0, stackHeight / 2, 0]}>
            <boxGeometry args={[2.5, stackHeight, 3.5]} />
            <meshStandardMaterial color="#f0f0f0" />
          </mesh>

          {/* Top card back */}
          <mesh position={[0, stackHeight + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.5, 3.5]} />
            <meshStandardMaterial color="#880000" />
            {/* Optional: Add same pattern detail as Card component if we extract it */}
          </mesh>
        </group>
      )}
      {/* Card count indicator floating above */}
      <mesh position={[0, stackHeight + 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 0.4]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.5} />
      </mesh>
      {/* Text label would go here if we had Text component available */}
    </group>
  );
}

"use client";
import { Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { memo, Suspense, useCallback, useEffect, useState } from "react";
import { ErrorBoundary } from "../../../src/components/errors/error-boundary";
import { hasWebGLSupport } from "../../../src/lib/webgl-support";
import type { Card as CardType } from "../types/card";
import type { DiceState } from "../types/dice";
import { Card } from "./objects/Card";
import { Deck } from "./objects/Deck";
import { Dice } from "./objects/Dice";
import { GameCamera } from "./scene/Camera";
import { TableLighting } from "./scene/Lighting";
import { TableSurface } from "./scene/TableSurface";

interface GameSceneProps {
  cards: CardType[];
  dice: DiceState[];
  playerId: string | null;
  interactionMode?: "orbit" | "interaction";
  onCardMove: (id: string, position: { x: number; y: number; z: number }) => void;
  onCardFlip: (id: string) => void;
  onCardGrab?: (id: string) => void;
  onCardRelease?: (id: string) => void;
  onDiceSettle: (id: string, value: number) => void;
  onDeckDraw: () => void;
  onDeckShuffle: () => void;
}

// Memoize Card to prevent unnecessary re-renders
const MemoizedCard = memo(Card);
const MemoizedDice = memo(Dice);

function WebGLFallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1a1a1a",
        color: "#999",
      }}
    >
      <p>WebGL is not available. Please try a different browser or enable hardware acceleration.</p>
    </div>
  );
}

export default function GameScene({
  cards,
  dice,
  playerId,
  interactionMode = "orbit",
  onCardMove,
  onCardFlip,
  onCardGrab,
  onCardRelease,
  onDiceSettle,
  onDeckDraw,
  onDeckShuffle,
}: GameSceneProps) {
  const [webglSupported, setWebglSupported] = useState(true);
  const [runtimeError, setRuntimeError] = useState(false);

  useEffect(() => {
    setWebglSupported(hasWebGLSupport());
  }, []);

  const handleWebGLError = useCallback(() => {
    setRuntimeError(true);
  }, []);

  // Cards on the table (not in anyone's hand)
  const tableCards = cards.filter((card) => card.ownerId === null);
  // Actual deck count - cards not owned
  const cardsInDeck = cards.filter((card) => card.ownerId === null);

  if (!webglSupported || runtimeError) {
    return <WebGLFallback />;
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
      <ErrorBoundary fallback={<WebGLFallback />} onError={handleWebGLError}>
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ position: [0, 8, 8], fov: 45 }}
          performance={{ min: 0.5 }}
        >
          <color attach="background" args={["#1a1a1a"]} />
          <Suspense fallback={null}>
            <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} debug={false}>
              <TableSurface />

              {/* Render deck */}
              <Deck count={cardsInDeck.length} onDraw={onDeckDraw} onShuffle={onDeckShuffle} />

              {/* Render cards on table (not at origin, meaning played cards) */}
              {tableCards
                .filter(
                  (card) =>
                    !(card.position.x === 0 && card.position.y === 0 && card.position.z === 0),
                )
                .map((card) => (
                  <MemoizedCard
                    key={card.id}
                    card={card}
                    isOwner={card.ownerId === playerId}
                    onMove={onCardMove}
                    onFlip={onCardFlip}
                    onGrab={onCardGrab}
                    onRelease={onCardRelease}
                  />
                ))}

              {/* Render dice */}
              {dice.map((die) => (
                <MemoizedDice key={die.id} state={die} onSettle={onDiceSettle} />
              ))}
            </Physics>
            <TableLighting />
            <GameCamera mode={interactionMode} />
            <Environment files="/textures/environment.jpg" background blur={0.5} />
          </Suspense>
        </Canvas>
      </ErrorBoundary>
    </div>
  );
}

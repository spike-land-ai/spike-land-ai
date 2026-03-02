"use client";
import { OrbitControls } from "@react-three/drei";

export function GameCamera({ mode }: { mode: "orbit" | "interaction" }) {
  return (
    <OrbitControls
      makeDefault
      enabled={mode === "orbit"}
      maxPolarAngle={Math.PI / 2 - 0.1}
      minDistance={2}
      maxDistance={20}
      target={[0, 0, 0]}
    />
  );
}

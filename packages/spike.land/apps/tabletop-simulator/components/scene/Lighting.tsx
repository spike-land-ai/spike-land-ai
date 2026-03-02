"use client";
import { ContactShadows } from "@react-three/drei";

export function TableLighting() {
  return (
    <>
      {/* Increased ambient light for better base visibility */}
      <ambientLight intensity={0.4} color="#ffffff" />

      {/* Main directional light with soft shadows */}
      <directionalLight
        position={[5, 12, 5]}
        intensity={0.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
        color="#fff5e6"
      />

      {/* Warm fill light from opposite direction */}
      <directionalLight position={[-4, 8, -4]} intensity={0.4} color="#ffe4c4" />

      {/* Cool rim light for depth */}
      <directionalLight position={[0, 6, -8]} intensity={0.3} color="#e6f0ff" />

      {/* Soft point light for ambient glow */}
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#fffaf0" distance={20} decay={2} />

      {/* Contact shadows for grounding objects */}
      <ContactShadows
        resolution={512}
        scale={20}
        blur={2.5}
        opacity={0.6}
        far={2}
        color="#0a2e1e"
      />

      {/* Subtle hemisphere light for natural outdoor-like lighting */}
      <hemisphereLight args={["#87ceeb", "#2d4a3e", 0.3]} />
    </>
  );
}

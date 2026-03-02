"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { type MotionValue, useScroll } from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Material, MeshStandardMaterial, SphereGeometry, Vector3 } from "three";
import { ErrorBoundary } from "@/components/errors/error-boundary";
import { hasWebGLSupport } from "@/lib/webgl-support";
import { detectSlowDevice } from "@/lib/device";

const COLORS = [
  "#FF0000", // Bright Red
  "#00FF00", // Bright Green
  "#0000FF", // Bright Blue
  "#FFFF00", // Bright Yellow
  "#FF00FF", // Bright Magenta
] as const;

interface FloatingOrbProps {
  position: [number, number, number];
  scale: number;
  material: Material;
  geometry: SphereGeometry;
  scrollYProgress: MotionValue<number>;
}

// Throttle physics impulses: apply every N frames to reduce JS->WASM bridge
// crossings from 40/frame to 40/N frames. At 60fps and N=2, this halves
// WASM bridge crossings (2400 -> 1200/sec) with negligible visual difference.
const IMPULSE_FRAME_SKIP = 2;

const FloatingOrb = memo(function FloatingOrb({
  position,
  scale,
  material,
  geometry,
  scrollYProgress,
}: FloatingOrbProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const impulse = useMemo(() => new Vector3(), []);
  const frameCount = useRef(0);

  useFrame((state) => {
    if (!rigidBodyRef.current) return;

    // Skip frames to reduce WASM bridge crossings
    frameCount.current = (frameCount.current + 1) % IMPULSE_FRAME_SKIP;
    if (frameCount.current !== 0) return;

    const t = state.clock.getElapsedTime();
    const scrollEffect = scrollYProgress.get() * 10;

    // Combine multiple forces into a single impulse vector to reduce
    // JS-WASM bridge calls (1 call instead of 3 per active frame)
    impulse.set(
      // Random X movement
      Math.sin(t * 2 + position[0]) * 0.05,
      // Y movement: Buoyancy + Random Y + Scroll effect
      0.08 * scale + Math.cos(t * 1.5 + position[1]) * 0.05 + scrollEffect * 0.1,
      // Random Z movement
      Math.cos(t * 2 + position[2]) * 0.05,
    );

    rigidBodyRef.current.applyImpulse(impulse, true);
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={position}
      colliders="ball"
      restitution={1}
      friction={0}
      linearDamping={0.5}
      angularDamping={0.5}
    >
      {/* Reuse shared geometry and material to reduce draw calls and memory */}
      <mesh scale={scale} geometry={geometry} material={material} />
    </RigidBody>
  );
});

FloatingOrb.displayName = "FloatingOrb";

function Scene() {
  // Single useScroll instance shared across all orbs via prop drilling,
  // avoiding 40 separate scroll listeners.
  const { scrollYProgress } = useScroll();

  // Create geometry once and share across all instances
  const geometry = useMemo(() => new SphereGeometry(1, 16, 16), []);

  // Create materials once and reuse them
  const materials = useMemo(() => {
    const mats: Record<string, MeshStandardMaterial> = {};
    COLORS.forEach((color) => {
      mats[color] = new MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.0,
        roughness: 0,
        metalness: 0,
        transparent: false,
        opacity: 1.0,
      });
    });
    return mats;
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [geometry, materials]);

  const orbs = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      position: [
        (Math.random() - 0.5) * 25,
        Math.random() * 20 - 10,
        (Math.random() - 0.5) * 15,
      ] as [number, number, number],
      scale: Math.random() * 0.8 + 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    }));
  }, []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Physics gravity={[0, -1, 0]}>
        {orbs.map((orb) => (
          <FloatingOrb
            key={orb.id}
            {...orb}
            material={materials[orb.color]!}
            geometry={geometry}
            scrollYProgress={scrollYProgress}
          />
        ))}
        {/* Bounds to keep orbs in view */}
        <CuboidCollider position={[0, -10, 0]} args={[20, 1, 10]} />
        <CuboidCollider position={[0, 20, 0]} args={[20, 1, 10]} />
        <CuboidCollider position={[-15, 0, 0]} args={[1, 20, 10]} />
        <CuboidCollider position={[15, 0, 0]} args={[1, 20, 10]} />
      </Physics>
    </>
  );
}

// Memoize the static fallback so it is never re-created on parent renders
const StaticFallback = memo(function StaticFallback() {
  return <div className="fixed inset-0 pointer-events-none -z-10 bg-zinc-950" />;
});

StaticFallback.displayName = "StaticFallback";

// detectSlowDevice utility is now imported from "@/lib/device"

// Use reduced antialias on low-DPR devices: at 1x DPR, MSAA is expensive
// and mostly invisible. At 2x+ the pixels are small enough that MSAA matters.
function shouldUseAntialias(): boolean {
  if (typeof window === "undefined") return false;
  return window.devicePixelRatio >= 2;
}

export function PhysicsBackground({ disabled = false }: { disabled?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const [runtimeError, setRuntimeError] = useState(false);
  // Derive isSlowDevice and antialias eagerly on mount to avoid extra renders
  const [deviceCaps, setDeviceCaps] = useState<{
    isSlowDevice: boolean;
    antialias: boolean;
  } | null>(null);

  // Track canvas visibility to pause rendering when off-screen
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setMounted(true);
    setWebglSupported(hasWebGLSupport());
    // Batch device capability checks into a single setState call
    setDeviceCaps({
      isSlowDevice: detectSlowDevice() || window.innerWidth < 768,
      antialias: shouldUseAntialias(),
    });
  }, []);

  // Pause the R3F render loop when the canvas is scrolled out of the viewport
  // or the browser tab is hidden. Uses IntersectionObserver + visibilitychange.
  useEffect(() => {
    if (!mounted || !canvasWrapperRef.current) return;

    // IntersectionObserver may not be available in all environments (e.g. jsdom)
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry?.isIntersecting ?? true);
      },
      { threshold: 0 },
    );

    observer.observe(canvasWrapperRef.current);

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [mounted]);

  const handleWebGLError = useCallback(() => {
    setRuntimeError(true);
  }, []);

  if (!mounted || deviceCaps === null) return null;

  if (disabled || !webglSupported || runtimeError || deviceCaps.isSlowDevice) {
    return <StaticFallback />;
  }

  return (
    <div
      ref={canvasWrapperRef}
      className="fixed inset-0 pointer-events-none -z-10 bg-zinc-950"
      // Promote the fixed layer to its own compositor layer and hint the
      // browser that this element's transform/opacity may change.
      style={{ willChange: "transform", contain: "strict" }}
    >
      <ErrorBoundary fallback={<StaticFallback />} onError={handleWebGLError}>
        <Canvas
          // Cap DPR at 1.5: beyond that the quality gain is imperceptible
          // for background particles while GPU fill cost scales quadratically.
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 15], fov: 45 }}
          gl={{
            antialias: deviceCaps.antialias,
            alpha: true,
            // Prefer energy efficiency on battery-powered devices
            powerPreference: "low-power",
          }}
          // Pause the render loop when off-screen (IntersectionObserver above
          // sets isVisible=false). frameloop="demand" would require manual
          // invalidate() calls inside physics; "always" is needed for physics
          // continuity but we gate it with the visibility state instead.
          frameloop={isVisible ? "always" : "never"}
        >
          <Scene />
        </Canvas>
      </ErrorBoundary>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/20 to-zinc-950 pointer-events-none" />
    </div>
  );
}

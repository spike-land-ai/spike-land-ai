/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { motion, useAnimation } from "framer-motion";
import { type ReactElement, useEffect, useRef } from "react";

const rgba = (r: number, g: number, b: number, a: number) =>
  `rgba(${r ?? 1}, ${g ?? 1}, ${b ?? 1}, ${a ?? 0.7})`;

export const MotionContainer = ({
  children,
  bgColor,
}: {
  children: ReactElement;
  bgColor: number[];
}) => {
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      // Recalculate position on resize
    };
    window.addEventListener("resize", handleResize);

    // Initial placement (bottom right)
    controls.start({
      x: window.innerWidth - (window.innerWidth > 768 ? 400 : 300) - 20, // rough width estimate
      y: window.innerHeight - (window.innerWidth > 768 ? 500 : 400) - 20,
    });

    return () => window.removeEventListener("resize", handleResize);
  }, [controls]);

  // Edge snapping logic
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentX = rect.left;
    const currentY = rect.top;
    const width = rect.width;
    const height = rect.height;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Distances to each edge
    const distLeft = currentX;
    const distRight = viewportWidth - (currentX + width);
    const distTop = currentY;
    const distBottom = viewportHeight - (currentY + height);

    // Find the minimum distance to decide which edge to snap to
    const minDist = Math.min(
      Math.abs(distLeft),
      Math.abs(distRight),
      Math.abs(distTop),
      Math.abs(distBottom),
    );

    let snapX = currentX;
    let snapY = currentY;
    const padding = 20; // 20px padding from the edge

    if (minDist === Math.abs(distLeft)) {
      snapX = padding;
    } else if (minDist === Math.abs(distRight)) {
      snapX = viewportWidth - width - padding;
    } else if (minDist === Math.abs(distTop)) {
      snapY = padding;
    } else if (minDist === Math.abs(distBottom)) {
      snapY = viewportHeight - height - padding;
    }

    // Keep within bounds completely
    snapX = Math.max(padding, Math.min(snapX, viewportWidth - width - padding));
    snapY = Math.max(padding, Math.min(snapY, viewportHeight - height - padding));

    controls.start({
      x: snapX,
      y: snapY,
      transition: { type: "spring", stiffness: 300, damping: 30 },
    });
  };

  return (
    <motion.div
      ref={containerRef}
      layout
      animate={controls}
      initial={{ padding: 0, borderRadius: 0 }}
      style={{
        backgroundColor: rgba(bgColor[0] ?? 0, bgColor[1] ?? 0, bgColor[2] ?? 0, 0.5),
        position: "fixed",
        top: 0,
        left: 0,
        padding: 8,
        borderRadius: 16,
      }}
      css={css`
        z-index: 1002;
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        box-shadow:
          0 10px 30px rgba(0, 0, 0, 0.3),
          0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        cursor: grab;
        &:active {
          cursor: grabbing;
        }
      `}
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      <div className="drag-handle w-full h-6 flex justify-center items-center mb-2 opacity-50 hover:opacity-100 transition-opacity">
        <div className="w-12 h-1.5 bg-white/50 rounded-full" />
      </div>
      <div
        className="content-area cursor-default relative z-10"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </motion.div>
  );
};

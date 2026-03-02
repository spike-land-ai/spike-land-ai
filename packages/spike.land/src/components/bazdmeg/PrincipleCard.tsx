"use client";

import { useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ScrollReveal } from "@/components/infographic/shared/ScrollReveal";
import type { LucideIcon } from "lucide-react";

interface Principle {
  id: number;
  title: string;
  oneLiner: string;
  color: string;
  icon: LucideIcon;
}

interface PrincipleCardProps {
  principle: Principle;
  index: number;
}

export function PrincipleCard({ principle, index }: PrincipleCardProps) {
  const Icon = principle.icon;
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Normalized mouse position for 3D tilt (-0.5 to 0.5)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Pixel mouse position for spotlight
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for rotation
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

  // Smooth springs for spotlight tracking
  const spotlightX = useSpring(mouseX, { stiffness: 300, damping: 40 });
  const spotlightY = useSpring(mouseY, { stiffness: 300, damping: 40 });

  // Map mouse position to rotation (-15deg to 15deg)
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

  // Spotlight gradient background
  const spotlightBackground = useMotionTemplate`radial-gradient(circle at ${spotlightX}px ${spotlightY}px, ${principle.color}30 0%, transparent 60%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return; // Ignore tilt on touch devices

    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Pixel coordinates from top-left for spotlight
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    mouseX.set(px);
    mouseY.set(py);

    // Normalized position from -0.5 to 0.5 for 3D tilt
    const nx = (px - width / 2) / width;
    const ny = (py - height / 2) / height;

    x.set(nx);
    y.set(ny);
  };

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <ScrollReveal delay={index * 0.1}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative h-full transition-transform duration-200 ease-out z-10"
      >
        {/* Animated Drop Shadow matching the card's accent color */}
        <motion.div
          animate={{
            opacity: isHovered ? 0.3 : 0,
            scale: isHovered ? 1.05 : 1,
          }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 rounded-[28px] blur-xl"
          style={{ backgroundColor: principle.color }}
        />

        {/* The Card Itself */}
        <div
          className="h-full p-8 flex flex-col gap-6 relative overflow-hidden group rounded-[28px] bg-white/[0.03] border backdrop-blur-xl transition-colors duration-300"
          style={{
            borderColor: isHovered ? `${principle.color}50` : "rgba(255, 255, 255, 0.05)",
            boxShadow: "inset 0 0 20px rgba(255, 255, 255, 0.01)",
          }}
        >
          {/* Spotlight Gradient tracking mouse */}
          <motion.div
            className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: spotlightBackground }}
          />

          {/* Shimmer Light Sweep */}
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={isHovered ? { x: "200%", opacity: 0.15 } : { x: "-100%", opacity: 0 }}
            transition={{
              duration: 1.5,
              ease: "easeInOut",
              repeat: isHovered ? Infinity : 0,
              repeatDelay: 2.5,
            }}
            className="absolute w-[200%] h-[200%] -top-[50%] -left-[50%] pointer-events-none bg-gradient-to-r from-transparent via-white to-transparent rotate-45 transform-gpu"
          />

          <div
            className="absolute -right-4 -top-4 w-32 h-32 blur-[50px] opacity-10 group-hover:opacity-30 transition-opacity duration-700 rounded-full"
            style={{ backgroundColor: principle.color }}
          />

          <div
            style={{
              transform: "translateZ(30px)",
              transformStyle: "preserve-3d",
            }}
            className="flex flex-col h-full z-10"
          >
            <div className="flex items-center justify-between mb-4 relative z-20">
              <motion.div
                animate={{
                  scale: isHovered ? 1.15 : 1,
                  rotate: isHovered ? -5 : 0,
                  y: isHovered ? -2 : 0,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg border border-white/10 overflow-hidden relative"
              >
                <div
                  className="absolute inset-0 opacity-20 transition-opacity duration-300 group-hover:opacity-40"
                  style={{ backgroundColor: principle.color }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />

                {/* Icon Glow Ring */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: isHovered ? 1 : 0,
                    scale: isHovered ? 1.1 : 0.8,
                  }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 rounded-2xl border"
                  style={{
                    borderColor: principle.color,
                    boxShadow: `0 0 15px ${principle.color}40`,
                  }}
                />

                <Icon
                  size={28}
                  className="relative z-10 drop-shadow-md transition-colors duration-300"
                  style={{ color: isHovered ? "#ffffff" : principle.color }}
                />
              </motion.div>
              <div
                className="text-5xl font-black opacity-10 tracking-tighter"
                style={{ color: principle.color }}
              >
                {String(principle.id).padStart(2, "0")}
              </div>
            </div>

            <div className="flex-1">
              <h3
                className="text-2xl font-bold text-white mb-3 transition-colors duration-300 group-hover:text-white"
                style={{ color: isHovered ? principle.color : "white" }}
              >
                {principle.title}
              </h3>
              <p className="text-zinc-400 text-[15px] leading-relaxed group-hover:text-zinc-300 transition-colors">
                {principle.oneLiner}
              </p>
            </div>
          </div>

          {/* Bottom Edge Glow */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: `linear-gradient(90deg, transparent, ${principle.color}, transparent)`,
            }}
          />
        </div>
      </motion.div>
    </ScrollReveal>
  );
}

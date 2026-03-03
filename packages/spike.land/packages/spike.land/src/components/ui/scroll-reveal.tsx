"use client";

import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * ScrollReveal - Reusable scroll-triggered animation wrapper
 *
 * Uses Framer Motion's whileInView for performant scroll-based animations.
 * Supports multiple animation presets and customizable delays for staggered reveals.
 */

type AnimationPreset =
  | "fadeUp"
  | "fadeIn"
  | "slideLeft"
  | "slideRight"
  | "scale";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  /** Animation preset to use */
  preset?: AnimationPreset;
  /** Delay before animation starts (useful for staggered reveals) */
  delay?: number;
  /** Duration of the animation in seconds */
  duration?: number;
  /** How much of the element should be visible before triggering (0-1) */
  threshold?: number;
  /** Whether to animate only once or every time element enters view */
  once?: boolean;
}

const presets: Record<AnimationPreset, Variants> = {
  fadeUp: {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slideLeft: {
    hidden: { opacity: 0, x: 50 },
    visible: { opacity: 1, x: 0 },
  },
  slideRight: {
    hidden: { opacity: 0, x: -50 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  },
};

export function ScrollReveal({
  children,
  className,
  preset = "fadeUp",
  delay = 0,
  duration = 0.5,
  threshold = 0.2,
  once = true,
}: ScrollRevealProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: threshold }}
      variants={presets[preset]}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1] as const, // Smooth cubic-bezier easing
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer - Parent component for staggered child animations
 *
 * Wrap multiple ScrollReveal components to automatically stagger their animations.
 */
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  /** Delay between each child animation */
  staggerDelay?: number;
  /** Whether to animate only once */
  once?: boolean;
}

const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
  once = true,
}: StaggerContainerProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.2 }}
      variants={{
        ...staggerContainerVariants,
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem - Child component to be used inside StaggerContainer
 */
interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  preset?: AnimationPreset;
}

export function StaggerItem({
  children,
  className,
  preset = "fadeUp",
}: StaggerItemProps) {
  return (
    <motion.div
      className={cn(className)}
      variants={presets[preset]}
      transition={{
        duration: 0.5,
        ease: [0.25, 0.1, 0.25, 1] as const,
      }}
    >
      {children}
    </motion.div>
  );
}

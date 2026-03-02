"use client";

import { slideUpVariants, transitions } from "@/lib/animation-variants";
import { motion, type Transition, useInView, type Variants } from "framer-motion";
import React, { useRef } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  variants?: Variants;
  transition?: Transition;
  threshold?: number;
  className?: string;
  delay?: number;
  once?: boolean;
}

export function ScrollReveal({
  children,
  variants = slideUpVariants,
  transition = transitions.standard,
  threshold = 0.2,
  className = "",
  delay = 0,
  once = true,
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, amount: threshold });

  const finalTransition = {
    ...transition,
    delay: delay,
  };

  return (
    <motion.div
      ref={ref}
      initial="initial"
      animate={isInView ? "animate" : "initial"}
      variants={variants}
      transition={finalTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

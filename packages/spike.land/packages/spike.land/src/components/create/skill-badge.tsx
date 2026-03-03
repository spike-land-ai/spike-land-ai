"use client";

import type { SkillDefinition } from "@/lib/create/skill-definitions";
import { motion } from "framer-motion";

interface SkillBadgeProps {
  skill: SkillDefinition;
  index: number;
}

export function SkillBadge({ skill, index }: SkillBadgeProps) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.8, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 30,
        delay: index * 0.05,
      }}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:brightness-125 hover:shadow-[0_0_12px_currentColor] ${skill.colorClass}`}
      title={skill.description}
    >
      <span>{skill.icon}</span>
      <span>{skill.name}</span>
    </motion.span>
  );
}

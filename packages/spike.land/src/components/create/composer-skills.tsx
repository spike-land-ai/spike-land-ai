"use client";

import { getMatchedSkills } from "@/lib/create/match-skills";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { SkillBadge } from "./skill-badge";

interface ComposerSkillsProps {
  query: string;
}

export function ComposerSkills({ query }: ComposerSkillsProps) {
  const skills = useMemo(() => getMatchedSkills(query), [query]);

  if (query.length < 2 || skills.length === 0) {
    return null;
  }

  return (
    <div className="relative flex-1 mx-2 overflow-hidden">
      {/* Gradient fade on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-zinc-900/80 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-zinc-900/80 to-transparent z-10 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1 overflow-x-auto scrollbar-none px-4"
      >
        <AnimatePresence mode="popLayout">
          {skills.map((skill, i) => (
            <SkillBadge key={skill.id} skill={skill} index={i} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

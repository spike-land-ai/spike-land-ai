"use client";

import { getMatchedSkills } from "@/lib/create/match-skills";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { SkillBadge } from "./skill-badge";

interface SkillsBarProps {
  query: string;
}

export function SkillsBar({ query }: SkillsBarProps) {
  const skills = useMemo(() => getMatchedSkills(query), [query]);

  if (query.length < 2 || skills.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="flex flex-wrap items-center gap-1.5 pt-2">
        <span className="text-xs text-muted-foreground font-medium">
          Skills:
        </span>
        <AnimatePresence mode="popLayout">
          {skills.map((skill, i) => <SkillBadge key={skill.id} skill={skill} index={i} />)}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

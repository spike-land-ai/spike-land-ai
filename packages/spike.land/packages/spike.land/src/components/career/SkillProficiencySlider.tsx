"use client";

import { Slider } from "@/components/ui/slider";

const LABELS = ["", "Beginner", "Basic", "Intermediate", "Advanced", "Expert"];

interface SkillProficiencySliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function SkillProficiencySlider({
  value,
  onChange,
}: SkillProficiencySliderProps) {
  return (
    <div className="flex items-center gap-2 shrink-0 w-40">
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v ?? value)}
        min={1}
        max={5}
        step={1}
        className="flex-1"
      />
      <span className="text-xs text-zinc-400 w-20 text-right">
        {LABELS[value]}
      </span>
    </div>
  );
}

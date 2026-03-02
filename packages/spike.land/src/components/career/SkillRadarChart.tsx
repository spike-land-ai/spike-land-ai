"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { SkillGap } from "@/lib/career/types";

interface SkillRadarChartProps {
  gaps: SkillGap[];
}

export function SkillRadarChart({ gaps }: SkillRadarChartProps) {
  // Take top 8 skills for readability
  const chartData = gaps.slice(0, 8).map((gap) => ({
    skill: gap.skill.title.length > 15 ? gap.skill.title.slice(0, 15) + "..." : gap.skill.title,
    required: gap.requiredLevel,
    yours: gap.userProficiency,
  }));

  if (chartData.length === 0) {
    return <p className="text-zinc-500 text-sm text-center py-8">No skill data available.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={chartData}>
        <PolarGrid stroke="#333" />
        <PolarAngleAxis dataKey="skill" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: "#71717a", fontSize: 10 }} />
        <Radar
          name="Required"
          dataKey="required"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.15}
        />
        <Radar
          name="Your Level"
          dataKey="yours"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.15}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

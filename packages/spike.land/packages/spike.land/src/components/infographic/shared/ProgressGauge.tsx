"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

import { useAnimatedNumber } from "../hooks/useAnimatedNumber";

interface ProgressGaugeProps {
  value: number; // 0 to 100
  type?: "circle" | "bar";
  label?: string;
  color?: string;
  className?: string;
  size?: number;
}

export function ProgressGauge({
  value,
  type = "bar",
  label,
  color = "#10B981",
  className,
  size = 120,
}: ProgressGaugeProps) {
  const animatedValue = useAnimatedNumber(value);

  if (type === "circle") {
    const radius = size / 2 - 10;
    const circumference = 2 * Math.PI * radius;

    return (
      <div className={cn("flex flex-col items-center", className)}>
        <div className="relative" style={{ width: size, height: size }}>
          {/* Background Circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
            />
            {/* Progress Circle */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              whileInView={{
                strokeDashoffset: circumference - (value / 100) * circumference,
              }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">
            {animatedValue}%
          </div>
        </div>
        {label && <div className="mt-2 text-sm text-gray-400">{label}</div>}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between mb-1 text-sm">
        <span className="text-gray-300">{label}</span>
        <span className="font-mono text-gray-400">{animatedValue}%</span>
      </div>
      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

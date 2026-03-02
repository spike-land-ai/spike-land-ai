"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useState } from "react";
import { ProgressGauge } from "./ProgressGauge";

interface Item {
  id: string;
  label: string;
  checked?: boolean;
}

interface InteractiveChecklistProps {
  items: Item[];
  title?: string;
  className?: string;
}

export function InteractiveChecklist({
  items: initialItems,
  title,
  className,
}: InteractiveChecklistProps) {
  const [items, setItems] = useState(initialItems);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  };

  const progress = Math.round((items.filter((i) => i.checked).length / items.length) * 100);

  return (
    <div className={cn("p-6 rounded-xl bg-white/5 border border-white/10", className)}>
      <div className="flex items-center justify-between mb-6">
        {title && <h3 className="text-lg font-semibold">{title}</h3>}
        <div className="w-16">
          <ProgressGauge
            value={progress}
            type="circle"
            size={50}
            color={progress === 100 ? "#10B981" : "#F59E0B"}
          />
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => toggleItem(item.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleItem(item.id);
              }
            }}
            role="checkbox"
            aria-checked={item.checked}
            tabIndex={0}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200",
              item.checked
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-100"
                : "bg-white/5 border-white/5 hover:bg-white/10 text-gray-300",
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded flex items-center justify-center border transition-colors",
                item.checked ? "bg-emerald-500 border-emerald-500" : "border-gray-500",
              )}
            >
              {item.checked && <Check size={14} className="text-white" />}
            </div>
            <span className="text-sm select-none">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

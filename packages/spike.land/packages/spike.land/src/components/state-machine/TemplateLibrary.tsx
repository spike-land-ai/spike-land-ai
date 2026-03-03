"use client";

import { useState } from "react";
import { LayoutTemplate, X } from "lucide-react";
import { CATEGORIES, TEMPLATES } from "./templates-data";

export type TemplateCategory =
  | "All"
  | "Basics"
  | "Web & API"
  | "E-Commerce"
  | "IoT & Hardware"
  | "Gaming"
  | "DevOps & CI/CD"
  | "Healthcare"
  | "Communication"
  | "Workflow"
  | "Finance"
  | "Embedded";

export interface TemplateDefinition {
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: TemplateCategory;
  states: Array<{
    id: string;
    type: "atomic" | "compound" | "parallel" | "final" | "history";
    parent?: string;
    initial?: string;
  }>;
  transitions: Array<{
    source: string;
    target: string;
    event: string;
    guard_expression?: string;
    delay_expression?: string;
    actions?: Array<
      {
        type: "assign" | "log" | "raise" | "custom";
        params: Record<string, unknown>;
      }
    >;
  }>;
  context?: Record<string, unknown>;
  initialState?: string;
}

interface TemplateLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: TemplateDefinition) => void;
}

export function TemplateLibrary(
  { isOpen, onClose, onSelectTemplate }: TemplateLibraryProps,
) {
  const [loading, setLoading] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("All");

  if (!isOpen) return null;

  const filtered = activeCategory === "All"
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={e => {
          if (e.key === "Escape" || e.key === "Enter") onClose();
        }}
        aria-label="Close template library"
      />

      {/* Dialog */}
      <div className="relative w-full max-w-3xl max-h-[85vh] mx-4 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Subtle top inner glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 flex-shrink-0 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shadow-inner">
              <LayoutTemplate className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 tracking-wide">
                Template Library
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {filtered.length} templates · Start from a pre-built architecture pattern
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label="Close template library"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/30 overflow-x-auto flex-shrink-0 custom-scrollbar">
          {CATEGORIES.map(cat => {
            const count = cat === "All"
              ? TEMPLATES.length
              : TEMPLATES.filter(t => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shadow-sm ${
                  activeCategory === cat
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 border border-transparent"
                }`}
              >
                {cat}
                <span
                  className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md border ${
                    activeCategory === cat
                      ? "bg-indigo-500/20 border-indigo-500/20 text-indigo-300"
                      : "bg-zinc-800/80 border-zinc-700/50 text-zinc-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Templates grid */}
        <div className="p-6 overflow-y-auto flex-1 bg-zinc-950/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(template => (
              <button
                key={template.name}
                onClick={async () => {
                  setLoading(template.name);
                  await onSelectTemplate(template);
                  setLoading(null);
                  onClose();
                }}
                disabled={loading !== null}
                className="group relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 text-left hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-lg overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${template.color}08, transparent)`,
                  borderColor: `${template.color}20`,
                }}
              >
                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background:
                      `radial-gradient(circle at right bottom, ${template.color}15, transparent 70%)`,
                  }}
                />

                <div
                  className="flex-shrink-0 p-2.5 rounded-xl border"
                  style={{
                    background: `${template.color}10`,
                    color: template.color,
                    borderColor: `${template.color}30`,
                  }}
                >
                  {template.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors leading-tight tracking-wide">
                    {template.name}
                    {loading === template.name && (
                      <span className="ml-2 text-[10px] text-zinc-500 animate-pulse font-medium uppercase tracking-widest">
                        Creating...
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-zinc-400/80 mt-1.5 leading-relaxed">
                    {template.description}
                  </p>
                  <div className="flex gap-2.5 mt-3 text-[10px] text-zinc-500 font-medium">
                    <span className="bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800/80">
                      {template.states.length} states
                    </span>
                    <span className="bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800/80">
                      {template.transitions.length} transitions
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { TEMPLATES };

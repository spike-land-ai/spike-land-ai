"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useSkillAutocomplete } from "@/hooks/useSkillAutocomplete";
import { useCareerStore } from "@/lib/store/career";
import { Plus } from "lucide-react";

export function SkillInput() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { suggestions, isLoading } = useSkillAutocomplete(query);
  const addSkill = useCareerStore((s) => s.addSkill);
  const userSkills = useCareerStore((s) => s.userSkills);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredSuggestions = suggestions.filter((s) => !userSkills.some((us) => us.uri === s.uri));

  return (
    <div ref={containerRef} className="relative">
      <Input
        placeholder="Search skills (e.g., JavaScript, project management, data analysis)..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => query.length > 0 && setIsOpen(true)}
        className="bg-zinc-800 border-white/[0.06]"
      />
      {isOpen && query.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-800 border border-white/[0.06] rounded-lg shadow-xl max-h-60 overflow-auto">
          {isLoading && <div className="px-3 py-2 text-sm text-zinc-500">Searching...</div>}
          {!isLoading && filteredSuggestions.length === 0 && (
            <div className="px-3 py-2 text-sm text-zinc-500">No skills found</div>
          )}
          {filteredSuggestions.map((skill) => (
            <button
              key={skill.uri}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 transition-colors text-left"
              onClick={() => {
                addSkill({
                  uri: skill.uri,
                  title: skill.title,
                  proficiency: 3,
                });
                setQuery("");
                setIsOpen(false);
              }}
            >
              <Plus className="w-3 h-3 text-zinc-500 shrink-0" />
              <span className="truncate">{skill.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import {
  getPersonaCookieClient,
  setPersonaCookieClient,
} from "@/lib/onboarding/get-persona-cookie";
import { PERSONAS } from "@/lib/onboarding/personas";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function PersonaSwitcher() {
  const router = useRouter();
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);

  useEffect(() => {
    setCurrentSlug(getPersonaCookieClient());
  }, []);

  const currentPersona = PERSONAS.find((p) => p.slug === currentSlug);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const slug = e.target.value;
    setPersonaCookieClient(slug);
    setCurrentSlug(slug);
    router.refresh();
  }

  return (
    <div className="my-8 p-4 rounded-xl border border-border bg-card space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <label
          htmlFor="persona-switcher"
          className="text-sm font-semibold text-foreground whitespace-nowrap"
        >
          Viewing as:
        </label>
        {currentPersona && (
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {currentPersona.name}
          </span>
        )}
      </div>
      <select
        id="persona-switcher"
        value={currentSlug ?? ""}
        onChange={handleChange}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="" disabled>
          Select a persona...
        </option>
        {PERSONAS.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name} — {p.description}
          </option>
        ))}
      </select>
    </div>
  );
}

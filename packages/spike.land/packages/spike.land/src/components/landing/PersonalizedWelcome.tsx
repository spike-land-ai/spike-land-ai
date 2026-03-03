"use client";

import type {
  OnboardingData,
  OnboardingPersona,
} from "@/lib/onboarding/personas";
import { PERSONAS } from "@/lib/onboarding/personas";
import { STORE_APPS } from "@/app/store/data/store-apps";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function PersonalizedWelcome() {
  const [persona, setPersona] = useState<OnboardingPersona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/onboarding")
      .then(res => res.json())
      .then((data: { onboarding: OnboardingData | null; }) => {
        if (data.onboarding) {
          const found = PERSONAS.find(p => p.id === data.onboarding!.personaId);
          setPersona(found ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="relative mx-auto max-w-6xl px-4 pb-12 pt-8">
        <div className="relative rounded-3xl border border-border bg-card/20 p-6 sm:p-8 animate-pulse">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-muted" />
            <div className="flex-1">
              <div className="h-3 w-32 bg-muted rounded mb-2" />
              <div className="h-5 w-48 bg-muted rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-2xl bg-muted" />)}
          </div>
        </div>
      </section>
    );
  }

  if (!persona) return null;

  const apps = STORE_APPS.filter(app => persona.recommendedAppSlugs.includes(app.slug));

  function getAppEmoji(slug: string): string {
    const emojiMap: Record<string, string> = {
      chess: "♟",
      audio: "🎵",
      music: "🎸",
      qa: "🧪",
      tabletop: "🎲",
      display: "📺",
      career: "💼",
      clean: "✨",
      mcp: "🔧",
      pixel: "🎨",
    };
    const key = Object.keys(emojiMap).find(k => slug.includes(k));
    return (key ? emojiMap[key] : undefined) ?? "⚡";
  }

  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-12 pt-8">
      <div className="relative rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] via-zinc-950/40 to-black/60 p-6 backdrop-blur-2xl sm:p-8 overflow-hidden shadow-[0_20px_60px_-15px_rgba(6,182,212,0.15)] group transition-all duration-500 hover:border-cyan-400/30 hover:shadow-[0_25px_60px_-15px_rgba(6,182,212,0.25)]">
        {/* Top highlight */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity"
        />

        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-600/10 blur-[100px] pointer-events-none rounded-full translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)] group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all duration-300">
              <Sparkles className="h-6 w-6 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            </div>
            <div>
              <p className="text-sm text-cyan-400/80 font-medium tracking-wide uppercase mb-0.5">
                Welcome back, {persona.name}
              </p>
              <p className="text-lg font-semibold text-white">
                {persona.heroText}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={persona.cta.href}
              className="group/cta inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-6 py-2.5 text-sm font-semibold text-cyan-400 transition-all duration-300 hover:bg-cyan-500/20 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-105"
            >
              {persona.cta.label}
              <ArrowRight className="h-4 w-4 transition-transform group-hover/cta:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Recommended apps grid */}
        <div className="relative z-10">
          <p className="mb-4 text-xs font-semibold tracking-widest uppercase text-zinc-500 group-hover:text-zinc-400 transition-colors">
            Recommended for you
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {apps.map(app => (
              <Link
                key={app.id}
                href={app.appUrl ?? `/store/${app.slug}`}
                className="group/card flex flex-col gap-1.5 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-5 transition-all duration-300 hover:border-cyan-500/30 hover:bg-white/[0.05] hover:-translate-y-1 hover:shadow-[0_10px_20px_-10px_rgba(6,182,212,0.3)] backdrop-blur-sm relative overflow-hidden"
              >
                <span className="text-2xl mb-1">{getAppEmoji(app.slug)}</span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{app.name}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 group-hover/card:translate-x-1 transition-all duration-300" />
                </div>
                <span className="line-clamp-2 text-xs text-zinc-500">
                  {app.tagline}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

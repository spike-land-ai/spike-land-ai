import { Heart, Twitter, Linkedin } from "lucide-react";
import { buttonVariants } from "../lazy-imports/button";
import { cn } from "@spike-land-ai/shared";
import { getPersonaSlug, getContentVariant } from "../core-logic/persona-content-variants";

export function PersonalizedSupportBox() {
  const personaSlug = getPersonaSlug();
  const variant = getContentVariant(personaSlug);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "https://spike.land";
  const shareTitle = "Check out spike.land — 80+ MCP tools built by indie developers";
  const xIntent = `https://x.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(pageUrl)}`;
  const linkedInIntent = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;

  return (
    <div className="mt-20 p-8 sm:p-12 rounded-[3rem] bg-card border border-border/50 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <Heart size={200} fill="currentColor" />
      </div>

      <div className="max-w-2xl relative z-10">
        <h3 className="text-3xl font-black tracking-tight mb-4">Support the Journey</h3>

        <p className="text-lg text-muted-foreground/80 font-medium leading-relaxed mb-10">
          {variant.supportCopy}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-12">
          <a
            href="/support"
            className={cn(
              buttonVariants({ variant: "default" }),
              "rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-transform",
            )}
          >
            <Heart className="mr-2 size-4" />
            Support Development
          </a>

          <a
            href="/about"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "rounded-2xl h-14 px-8 font-black uppercase tracking-widest text-xs",
            )}
          >
            Learn More
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
            Spread the Word
          </p>
          <a
            href={xIntent}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Twitter size={14} /> X / Twitter
          </a>
          <a
            href={linkedInIntent}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Linkedin size={14} /> LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}

import { LandingHero } from "./landing/LandingHero";
import { AppShowcase } from "./landing/AppShowcase";
import { TryItNow } from "./landing/TryItNow";
import { TryItCta } from "./landing/TryItCta";
import { BlogListView } from "./BlogList";
import { Link } from "./ui/link";
import { Search, Globe, Code2, ArrowRight, Zap, CheckCircle2 } from "lucide-react";
import { cn } from "@/shared/utils/cn";

export function LandingPage() {
  return (
    <div className="text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      <LandingHero />
      
      <div className="space-y-32 sm:space-y-48 pb-32">
        <section className="relative">
          <TryItNow />
        </section>

        <section className="relative overflow-hidden">
          <AppShowcase />
        </section>

        <section className="relative">
          <TryItCta />
        </section>

        <section
          aria-labelledby="features-heading"
          className="py-32 border-y border-border/50 bg-muted/30 relative"
        >
          {/* Decorative background blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="max-w-5xl mx-auto px-6 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
              <h2 id="features-heading" className="text-4xl sm:text-6xl font-black tracking-tighter text-foreground text-balance leading-none">
                How it <span className="text-primary italic">actually</span> works
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed font-medium">
                spike.land connects your AI assistant to real-world tools using the{" "}
                <span className="text-foreground font-bold underline decoration-primary/30 decoration-4 underline-offset-4">Model Context Protocol</span>.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  title: "Browse & connect",
                  desc: "Pick from our library of ready-made tools. Each one connects to your AI assistant in seconds — no coding required.",
                  icon: Search,
                  color: "text-blue-500"
                },
                {
                  title: "Works everywhere",
                  desc: "Built on an open standard supported by Claude, ChatGPT, and Cursor. Connect once, use anywhere in your workflow.",
                  icon: Globe,
                  color: "text-emerald-500"
                },
                {
                  title: "Build your own",
                  desc: "Need something custom? Describe it, and our builder creates it for you. We handle hosting, security, and scaling.",
                  icon: Code2,
                  color: "text-amber-500"
                }
              ].map((feature, i) => (
                <div key={i} className="group p-8 rounded-[2.5rem] bg-card border border-border/50 shadow-xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-2">
                  <div className={cn("size-14 rounded-2xl bg-muted flex items-center justify-center mb-6 group-hover:scale-110 transition-transform", feature.color)}>
                    <feature.icon size={28} />
                  </div>
                  <h3 className="text-xl font-black mb-4 tracking-tight">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed font-medium text-sm">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-20 p-8 rounded-[2rem] bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  <Zap size={20} fill="currentColor" />
                </div>
                <div>
                  <p className="font-black text-foreground">Ready to start building?</p>
                  <p className="text-sm text-muted-foreground font-medium">Join 5,000+ developers building on the edge.</p>
                </div>
              </div>
              <Link
                href="/apps/new"
                className="px-8 py-4 bg-foreground text-background rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl"
              >
                Create your first tool
              </Link>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="updates-heading"
          className="py-20"
        >
          <div className="max-w-7xl mx-auto px-6">
            <header className="mb-16 flex items-end justify-between border-b border-border/50 pb-8">
              <div className="space-y-2">
                <h2
                  id="updates-heading"
                  className="text-4xl sm:text-5xl font-black tracking-tighter text-foreground"
                >
                  Latest Intelligence
                </h2>
                <p className="text-lg text-muted-foreground font-medium">Insights from the edge of AI development.</p>
              </div>
              <Link
                href="/blog"
                className="hidden sm:flex items-center gap-2 text-sm font-black uppercase tracking-widest text-primary hover:gap-4 transition-all"
              >
                View Archive
                <ArrowRight size={16} />
              </Link>
            </header>

            <BlogListView limit={3} showHeader={false} />
            
            <div className="mt-12 sm:hidden">
              <Link
                href="/blog"
                className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-muted font-black uppercase tracking-widest text-xs text-foreground"
              >
                View Archive
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Bot,
  BrainCircuit,
  Clock,
  Banknote,
  TrendingUp,
  FileText,
  MessageSquare,
  Search,
  Users,
  CheckCircle2,
  ArrowRight,
  Zap,
} from "lucide-react";
import { cn } from "../../styling/cn";

// Hooks
function useIntersectionOnce(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, threshold]);

  return { ref, visible };
}

function useCounter(target: number, active: boolean, duration = 1200) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (target === 0) {
      setCount(0);
      return;
    }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, duration]);

  return count;
}

/** Extracted component so useCounter is called at the top level (Rules of Hooks). */
function StatCard({
  stat,
  active,
}: {
  stat: { value: number; suffix: string; label: string; icon: LucideIcon };
  active: boolean;
}) {
  const Icon = stat.icon;
  const count = useCounter(stat.value, active);
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <Icon className="h-5 w-5 text-primary mb-2" />
      <span className="text-3xl font-extrabold tabular-nums">
        {count}
        {stat.suffix}
      </span>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">
        {stat.label}
      </span>
    </div>
  );
}

const WHATSAPP_URL = "https://wa.me/36709537783";

export function AiAutomatizalasApp() {
  const [heroRevealed, setHeroRevealed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setHeroRevealed(true), 80);
    return () => clearTimeout(id);
  }, []);

  const { ref: statsRef, visible: statsVisible } = useIntersectionOnce(0.3);
  const { ref: useCasesRef, visible: useCasesVisible } = useIntersectionOnce(0.1);
  const { ref: pricingRef, visible: pricingVisible } = useIntersectionOnce(0.1);
  const { ref: processRef, visible: processVisible } = useIntersectionOnce(0.1);
  const { ref: ctaRef, visible: ctaVisible } = useIntersectionOnce(0.2);

  const STATS = [
    { value: 40, suffix: "+", label: "Óra/hó Megtakarítás", icon: Clock },
    { value: 250, suffix: "k+", label: "Ft/hó Érték", icon: Banknote },
    { value: 7, suffix: "+", label: "Iparág", icon: TrendingUp },
    { value: 30, suffix: "", label: "Nap alatt kész", icon: Zap },
  ];

  const USE_CASES = [
    {
      title: "Ajánlat-generálás",
      desc: "Személyre szabott árajánlatok készítése percek alatt, ügyféladatok alapján.",
      icon: FileText,
    },
    {
      title: "Ügyfélkérdések kezelése",
      desc: "0-24 automata válaszadás a leggyakoribb kérdésekre (GYIK, nyitvatartás, árak).",
      icon: MessageSquare,
    },
    {
      title: "Tudásbázis integráció",
      desc: "Belső céges dokumentumok, szabályzatok azonnali kereshetősége AI segítségével.",
      icon: Search,
    },
    {
      title: "Dokumentum-feldolgozás",
      desc: "Számlák, szerződések, űrlapok adatainak automatikus kinyerése és rendszerezése.",
      icon: BrainCircuit,
    },
    {
      title: "Lead-kezelés",
      desc: "Beérkező érdeklődők előszűrése és a megfelelő kollégához irányítása.",
      icon: Users,
    },
  ];

  const INDUSTRIES = [
    "Könyvelő",
    "Ügyvéd",
    "Rendelő",
    "Szerviz",
    "Kivitelező",
    "Ingatlanos",
    "Webshop",
  ];

  const PRICING = [
    { name: "Starter", price: "190-290k", desc: "Alapvető ismétlődő feladatok automatizálása." },
    { name: "Business", price: "390-790k", desc: "Komplex, több rendszert érintő folyamatok." },
    { name: "Growth", price: "890k-1.8M", desc: "Teljes cégre kiterjedő AI transzformáció." },
  ];

  const PROCESS = [
    {
      step: 1,
      title: "Felmérés",
      desc: "Megértjük a jelenlegi folyamatait és azonosítjuk a szűk keresztmetszeteket.",
    },
    {
      step: 2,
      title: "Pilot",
      desc: "Gyors prototípust építünk egy konkrét problémára, hogy lássa az értéket.",
    },
    {
      step: 3,
      title: "Finomhangolás",
      desc: "Élesítés után folyamatosan monitorozzuk és optimalizáljuk az eredményeket.",
    },
  ];

  return (
    <div className="rubik-page w-full pb-20">
      {/* HERO */}
      <section className="rubik-container relative flex min-h-[70vh] flex-col items-center justify-center text-center pt-20 pb-16">
        <div
          className={cn(
            "rubik-eyebrow mb-6 inline-flex items-center gap-2",
            "transition-all duration-700",
            heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4",
          )}
        >
          Tatabánya és környéke
        </div>

        <h1
          className={cn(
            "text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl max-w-4xl",
            "transition-all duration-700 delay-100",
            heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          <span className="block text-foreground">AI Automatizálás</span>
          <span className="block bg-gradient-to-r from-primary via-primary-light to-primary bg-clip-text text-transparent">
            Helyi Cégeknek
          </span>
        </h1>

        <p
          className={cn(
            "mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed",
            "transition-all duration-700 delay-200",
            heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          Kevesebb adminisztráció, gyorsabb működés, mérhető megtérülés. Szabadítsa fel kollégái
          idejét, és fókuszáljon a növekedésre.
        </p>

        <div
          className={cn(
            "mt-10 flex flex-col items-center gap-3 sm:flex-row",
            "transition-all duration-700 delay-300",
            heroRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
          )}
        >
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Bot className="h-4 w-4" />
            Ingyenes Konzultáció
          </a>
        </div>
      </section>

      {/* STATS */}
      <section
        ref={statsRef}
        className={cn(
          "rubik-container mb-20",
          "transition-all duration-700",
          statsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        )}
      >
        <div className="rubik-panel grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0 p-0 overflow-hidden">
          {STATS.map((stat, i) => (
            <StatCard key={i} stat={stat} active={statsVisible} />
          ))}
        </div>
      </section>

      {/* USE CASES & INDUSTRIES */}
      <section
        ref={useCasesRef}
        className={cn(
          "rubik-container mb-24",
          "transition-all duration-700",
          useCasesVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        )}
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Mire használható?</h2>
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
            {INDUSTRIES.map((ind) => (
              <span
                key={ind}
                className="px-3 py-1 rounded-full border border-border bg-muted/50 text-xs font-medium text-muted-foreground"
              >
                {ind}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((uc, i) => {
            const Icon = uc.icon;
            return (
              <div
                key={i}
                className="rubik-panel p-6 flex flex-col gap-3 group hover:border-primary/40 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{uc.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{uc.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* PROCESS */}
      <section
        ref={processRef}
        className={cn(
          "rubik-container mb-24",
          "transition-all duration-700",
          processVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        )}
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">A bevezetés folyamata</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {PROCESS.map((p, i) => (
            <div key={i} className="relative rubik-panel p-6">
              <div className="absolute -top-4 -left-4 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-lg">
                {p.step}
              </div>
              <h3 className="font-semibold text-lg mb-2 mt-2">{p.title}</h3>
              <p className="text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section
        ref={pricingRef}
        className={cn(
          "rubik-container mb-24",
          "transition-all duration-700",
          pricingVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        )}
      >
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Csomagok</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PRICING.map((pkg, i) => (
            <div
              key={i}
              className={cn(
                "rubik-panel p-8 flex flex-col",
                i === 1 && "rubik-panel-strong border-primary/50 relative",
              )}
            >
              {i === 1 && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                  Legnépszerűbb
                </div>
              )}
              <h3 className="font-bold text-xl mb-2">{pkg.name}</h3>
              <div className="text-2xl font-extrabold mb-4">
                {pkg.price} <span className="text-sm font-normal text-muted-foreground">Ft</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6 flex-1">{pkg.desc}</p>
              <ul className="space-y-2 mb-8">
                <li className="flex gap-2 text-sm items-start">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Egyedi felmérés
                </li>
                <li className="flex gap-2 text-sm items-start">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Betanítás
                </li>
                <li className="flex gap-2 text-sm items-start">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Support
                </li>
              </ul>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-colors",
                  i === 1
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-foreground hover:bg-muted/80",
                )}
              >
                Érdekel
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        ref={ctaRef}
        className={cn(
          "rubik-container",
          "transition-all duration-700",
          ctaVisible ? "opacity-100 scale-100" : "opacity-0 scale-95",
        )}
      >
        <div className="rubik-panel-strong p-10 sm:p-14 text-center border-primary/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
          <h2 className="text-3xl font-bold mb-4 relative">Készen áll a szintlépésre?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8 relative">
            Foglaljon egy 30 perces, ingyenes online konzultációt, ahol átbeszéljük az Ön cégére
            szabott lehetőségeket.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg"
          >
            Ingyenes Konzultáció
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </div>
  );
}

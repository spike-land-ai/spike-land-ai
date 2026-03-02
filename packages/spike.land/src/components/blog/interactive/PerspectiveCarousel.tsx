"use client";

import { useCallback, useRef, useState } from "react";
import { useInViewProgress } from "./useInViewProgress";
import { motion } from "framer-motion";

const PERSPECTIVES = [
  {
    emoji: "👨‍🍳",
    title: "Chef",
    quote: "MCP is my standardized recipe card system.",
    body: "Every kitchen tool — oven, mixer, grill — accepts the same recipe card format. I don't rewrite instructions for each appliance. I write once, and any tool in my kitchen understands it.",
  },
  {
    emoji: "🔌",
    title: "Electrician",
    quote: "It's a universal junction box.",
    body: "Instead of custom wiring for every appliance, MCP gives every AI tool the same socket type. Plug in any tool, and it just works — safely, with proper grounding.",
  },
  {
    emoji: "✈️",
    title: "Pilot",
    quote: "Think of it as standardized radio protocol.",
    body: "Every airport tower worldwide uses the same communication protocol. MCP does this for AI — every tool speaks the same language, so there's no miscommunication.",
  },
  {
    emoji: "📚",
    title: "Librarian",
    quote: "It's a universal catalog system.",
    body: "Imagine if every library used a different filing system. MCP is like the Dewey Decimal System for AI — Tools are checkout requests, Resources are the books on the shelves, and Prompts are the research guides that help you find what you need.",
  },
  {
    emoji: "🏛️",
    title: "Diplomat",
    quote: "MCP is diplomatic protocol for machines.",
    body: "When nations talk, there's an agreed protocol — credentials, channels, formats. MCP does the same: AI clients present credentials, discover services, and make requests through proper channels.",
  },
  {
    emoji: "🏥",
    title: "Surgeon",
    quote: "It's the surgical instrument standard.",
    body: "Every instrument in my tray follows ISO standards for grip, sterility, and labeling. MCP standardizes AI tools the same way — I know exactly what each tool does and how to use it.",
  },
  {
    emoji: "🎵",
    title: "Conductor",
    quote: "MCP is my musical score notation.",
    body: "A hundred musicians from different countries can play together because they share notation (the protocol), sheet music (Resources), rehearsal marks (Prompts), and performance directions (Tools). MCP gives AI the same shared vocabulary.",
  },
  {
    emoji: "🚒",
    title: "Firefighter",
    quote: "It's standardized hydrant connections.",
    body: "Every fire hydrant in the city uses the same coupling. My hose fits them all. MCP means any AI client can connect to any tool server without custom adapters.",
  },
  {
    emoji: "🔧",
    title: "Plumber",
    quote: "Think standard pipe fittings.",
    body: "Half-inch copper, three-quarter PEX — there are standards so parts from any manufacturer connect. MCP is that standard for AI tool connections.",
  },
  {
    emoji: "👩‍🏫",
    title: "Teacher",
    quote: "It's a universal lesson plan format.",
    body: "MCP is a universal lesson plan format where Tools are assignments, Resources are textbooks, and Prompts are teaching guides. Any substitute teacher — or AI — can walk in and know exactly what to do.",
  },
  {
    emoji: "🏗️",
    title: "Architect",
    quote: "MCP is building code for AI.",
    body: "Building codes ensure any electrician, plumber, or contractor can work on any building. MCP ensures any AI agent can work with any tool — because they follow the same specification.",
  },
  {
    emoji: "💊",
    title: "Pharmacist",
    quote: "It's the universal prescription format.",
    body: "Doctors write prescriptions in a standard format that any pharmacy worldwide can fill. MCP lets AI agents write 'prescriptions' that any tool server can execute.",
  },
  {
    emoji: "🎬",
    title: "Film Director",
    quote: "Think of it as the film production protocol.",
    body: "Camera, sound, lighting — every department follows the same call sheet format. MCP is the call sheet for AI: every tool knows when to act, what to deliver, and in what format.",
  },
  {
    emoji: "🗼",
    title: "Air Traffic Controller",
    quote: "MCP is the ICAO standard for AI.",
    body: "Every aircraft worldwide follows ICAO communication standards. MCP gives AI tools the same global standard — discover capabilities, request services, get structured responses.",
  },
  {
    emoji: "🔑",
    title: "Locksmith",
    quote: "It's a master key system.",
    body: "A master key system lets one key pattern access many locks, each with defined permissions. MCP lets one AI client access many tool servers, each with defined capabilities.",
  },
  {
    emoji: "📮",
    title: "Postmaster",
    quote: "MCP is the Universal Postal Union.",
    body: "Mail from any country reaches any address because postal services agreed on a common format. MCP is that agreement for AI — any client can reach any tool server using the same addressing scheme.",
  },
];

interface PerspectiveCardProps {
  emoji: string;
  title: string;
  quote: string;
  body: string;
  index: number;
  visible: boolean;
}

function PerspectiveCard({ emoji, title, quote, body, index, visible }: PerspectiveCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.05, 0.4),
        ease: "easeOut",
      }}
      className="min-w-[280px] md:min-w-0 snap-start flex-shrink-0 md:flex-shrink
                 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6
                 cursor-default select-none group
                 hover:bg-slate-800/60 hover:border-cyan-500/30 transition-colors"
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl leading-none group-hover:scale-110 transition-transform duration-300">
          {emoji}
        </span>
        <span className="font-bold text-slate-100 text-base">{title}</span>
      </div>
      <p className="text-cyan-400 italic text-sm mb-3 leading-snug font-medium">
        &ldquo;{quote}&rdquo;
      </p>
      <p className="text-slate-400 text-sm leading-relaxed opacity-90">{body}</p>
    </motion.div>
  );
}

export function PerspectiveCarousel() {
  const { ref, progress } = useInViewProgress();
  const [activeDot, setActiveDot] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = progress > 0.15;

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const scrollLeft = el.scrollLeft;
    // Calculate which card is most center
    const index = Math.round(scrollLeft / (280 + 16)); // card width + gap
    setActiveDot(Math.max(0, Math.min(index, PERSPECTIVES.length - 1)));
  }, []);

  return (
    <div ref={ref} className="my-20">
      <div className="flex items-center justify-between mb-8 px-2">
        <h3 className="text-lg font-mono text-slate-400 uppercase tracking-widest text-sm">
          Perspectives on MCP
        </h3>
        <div className="hidden md:flex gap-1">
          <div className="w-2 h-2 rounded-full bg-cyan-500/50 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-cyan-500/30" />
          <div className="w-2 h-2 rounded-full bg-cyan-500/10" />
        </div>
      </div>

      {/* Mobile: horizontal scroll carousel */}
      <div className="relative md:hidden">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-6
                     scrollbar-none px-4 -mx-4"
          style={{ scrollbarWidth: "none" }}
          onScroll={handleScroll}
        >
          {PERSPECTIVES.map((p, i) => (
            <PerspectiveCard key={p.title} {...p} index={i} visible={visible} />
          ))}
        </div>

        {/* Mobile nav dots */}
        <div className="flex justify-center gap-2 mt-2">
          {PERSPECTIVES.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                scrollRef.current?.scrollTo({
                  left: i * (280 + 16),
                  behavior: "smooth",
                });
                setActiveDot(i);
              }}
              className={`rounded-full transition-all duration-300 ${
                i === activeDot
                  ? "w-6 h-1.5 bg-cyan-400"
                  : "w-1.5 h-1.5 bg-slate-700 hover:bg-slate-600"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Desktop: Grid revealing items as you scroll */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
        {PERSPECTIVES.map((p, i) => (
          <PerspectiveCard key={p.title} {...p} index={i} visible={visible} />
        ))}
      </div>
    </div>
  );
}

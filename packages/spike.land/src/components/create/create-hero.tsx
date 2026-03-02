"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { ComposerBox } from "./composer-box";

const STARTER_IDEAS = [
  "Todo List",
  "Calculator",
  "Color Picker",
  "Markdown Editor",
  "Pomodoro Timer",
  "Weather Widget",
  "Quiz App",
  "Habit Tracker",
  "Expense Tracker",
  "Snake Game",
  "Flashcard App",
  "BMI Calculator",
  "Countdown Timer",
  "Drawing Canvas",
  "Password Generator",
  "Unit Converter",
  "Morse Code Translator",
  "Fibonacci Visualizer",
  "Regex Tester",
  "JSON Formatter",
  "Gradient Generator",
  "Random Quote Generator",
  "Typing Speed Test",
  "Number Guessing Game",
] as const;

export function CreateHero({ prompt }: { prompt?: string }) {
  const [initialPrompt, setInitialPrompt] = useState<string | undefined>(prompt);

  const handleChipClick = useCallback((idea: string) => {
    // Force a re-render even when the same chip is clicked twice by toggling
    // through undefined first, then setting the new value on the next tick.
    setInitialPrompt(undefined);
    // Use queueMicrotask so React flushes the undefined state before setting
    // the new value, ensuring the useEffect in ComposerBox always fires.
    queueMicrotask(() => {
      setInitialPrompt(idea);
    });
  }, []);

  return (
    <section className="text-center space-y-6 pt-8">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-sm text-cyan-400">
        <Sparkles className="w-4 h-4" />
        <span className="font-semibold tracking-widest uppercase text-[10px]">AI App Builder</span>
      </div>

      <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold text-white tracking-tighter">
        Describe it.{" "}
        <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          We build it.
        </span>
      </h1>

      <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-light">
        Type any app idea and watch AI generate a fully working React app in seconds. No setup, no
        boilerplate — just describe what you want.
      </p>

      <div className="pt-4">
        <ComposerBox initialPrompt={initialPrompt} />
      </div>

      {/* Starter idea chips */}
      <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
        {STARTER_IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => handleChipClick(idea)}
            className="px-3.5 py-1.5 text-sm rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/[0.07] transition-all cursor-pointer"
          >
            {idea}
          </button>
        ))}
      </div>
    </section>
  );
}

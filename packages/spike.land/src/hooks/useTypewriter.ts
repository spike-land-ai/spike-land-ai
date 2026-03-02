"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_PROMPTS = [
  "Build a retro arcade game...",
  "Create a data dashboard with charts...",
  "Design a music player with visualizer...",
  "Make a 3D planet explorer...",
  "Build a todo app with drag and drop...",
  "Create a recipe book with search...",
];

interface UseTypewriterOptions {
  prompts?: string[];
  typeSpeed?: number;
  deleteSpeed?: number;
  pauseDuration?: number;
  enabled?: boolean;
}

interface UseTypewriterReturn {
  displayText: string;
  isTyping: boolean;
}

export function useTypewriter(options?: UseTypewriterOptions): UseTypewriterReturn {
  const {
    prompts = DEFAULT_PROMPTS,
    typeSpeed = 50,
    deleteSpeed = 30,
    pauseDuration = 2000,
    enabled = true,
  } = options ?? {};

  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const promptIndex = useRef(0);
  const charIndex = useRef(0);
  const phase = useRef<"typing" | "pausing" | "deleting">("typing");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Store mutable config in refs to keep tick callback stable
  const promptsRef = useRef(prompts);
  const typeSpeedRef = useRef(typeSpeed);
  const deleteSpeedRef = useRef(deleteSpeed);
  const pauseDurationRef = useRef(pauseDuration);
  const enabledRef = useRef(enabled);

  promptsRef.current = prompts;
  typeSpeedRef.current = typeSpeed;
  deleteSpeedRef.current = deleteSpeed;
  pauseDurationRef.current = pauseDuration;
  enabledRef.current = enabled;

  const tick = useCallback(() => {
    if (!enabledRef.current) return;

    const currentPrompts = promptsRef.current;
    const currentPrompt = currentPrompts[promptIndex.current % currentPrompts.length]!;

    if (phase.current === "typing") {
      setIsTyping(true);
      if (charIndex.current < currentPrompt.length) {
        charIndex.current++;
        setDisplayText(currentPrompt.slice(0, charIndex.current));
        timerRef.current = setTimeout(tick, typeSpeedRef.current);
      } else {
        phase.current = "pausing";
        setIsTyping(false);
        timerRef.current = setTimeout(tick, pauseDurationRef.current);
      }
    } else if (phase.current === "pausing") {
      phase.current = "deleting";
      setIsTyping(true);
      timerRef.current = setTimeout(tick, deleteSpeedRef.current);
    } else if (phase.current === "deleting") {
      if (charIndex.current > 0) {
        charIndex.current--;
        setDisplayText(currentPrompt.slice(0, charIndex.current));
        timerRef.current = setTimeout(tick, deleteSpeedRef.current);
      } else {
        promptIndex.current = (promptIndex.current + 1) % currentPrompts.length;
        phase.current = "typing";
        setIsTyping(false);
        timerRef.current = setTimeout(tick, typeSpeedRef.current * 2);
      }
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      timerRef.current = setTimeout(tick, typeSpeed);
    } else {
      setDisplayText("");
      charIndex.current = 0;
      phase.current = "typing";
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, tick, typeSpeed]);

  return { displayText, isTyping };
}

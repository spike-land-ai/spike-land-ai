/**
 * useQuiz — BeUniq persona quiz state hook
 *
 * Drives the 4-question binary quiz against the beuniq API endpoints.
 * Persists the persona result to localStorage so it survives page refreshes.
 */

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../core-logic/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  text: string;
  yes_label: string;
  no_label: string;
}

export interface QuizPersona {
  id: number;
  slug: string;
  name: string;
  description: string;
  hero_text: string;
  cta: { label: string; href: string };
  recommended_app_slugs: string[];
  default_theme: "light" | "dark" | "theme-soft-light" | "theme-deep-dark";
}

export type QuizPhase = "idle" | "loading" | "question" | "revealing" | "done" | "error";

export interface QuizState {
  phase: QuizPhase;
  sessionId: string | null;
  currentQuestion: QuizQuestion | null;
  answersCount: number;
  persona: QuizPersona | null;
  errorMessage: string | null;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const PERSONA_STORAGE_KEY = "spike_beuniq_persona";
const SESSION_STORAGE_KEY = "spike_beuniq_session";

export function loadStoredPersona(): QuizPersona | null {
  try {
    const raw = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QuizPersona;
  } catch {
    return null;
  }
}

export function clearStoredPersona(): void {
  localStorage.removeItem(PERSONA_STORAGE_KEY);
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

// ── API response shapes ───────────────────────────────────────────────────────

interface StartSessionResponse {
  session_id: string;
  question: QuizQuestion | null;
}

interface AnswerResponse {
  session_id: string;
  answers_so_far?: number;
  question?: QuizQuestion | null;
  completed?: boolean;
  persona?: QuizPersona;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useQuiz() {
  const [state, setState] = useState<QuizState>(() => {
    const storedPersona = loadStoredPersona();
    return {
      phase: storedPersona ? "done" : "idle",
      sessionId: null,
      currentQuestion: null,
      answersCount: 0,
      persona: storedPersona,
      errorMessage: null,
    };
  });

  // Restore in-progress session from storage (e.g. after hard refresh mid-quiz)
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored && state.phase === "idle") {
      try {
        const { sessionId } = JSON.parse(stored) as { sessionId: string };
        if (sessionId) {
          // Don't auto-resume — just discard stale session so user starts fresh
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }
  }, [state.phase]);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, phase: "loading", errorMessage: null }));

    try {
      const res = await apiFetch("/mcp/tool/beuniq_start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as StartSessionResponse;
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ sessionId: data.session_id }),
      );

      setState({
        phase: "question",
        sessionId: data.session_id,
        currentQuestion: data.question,
        answersCount: 0,
        persona: null,
        errorMessage: null,
      });
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "error",
        errorMessage: err instanceof Error ? err.message : "Failed to start quiz",
      }));
    }
  }, []);

  const answer = useCallback(
    async (value: boolean) => {
      if (!state.sessionId || state.phase !== "question") return;

      setState((s) => ({ ...s, phase: "loading" }));

      try {
        const res = await apiFetch("/mcp/tool/beuniq_answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: state.sessionId, answer: value }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as AnswerResponse;

        if (data.completed && data.persona) {
          // Persist for future visits
          localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(data.persona));
          localStorage.removeItem(SESSION_STORAGE_KEY);

          setState({
            phase: "revealing",
            sessionId: data.session_id,
            currentQuestion: null,
            answersCount: 4,
            persona: data.persona,
            errorMessage: null,
          });

          // Transition to "done" after reveal animation has a moment to play
          setTimeout(() => {
            setState((s) => ({ ...s, phase: "done" }));
          }, 100);
        } else {
          setState((s) => ({
            ...s,
            phase: "question",
            currentQuestion: data.question ?? null,
            answersCount: data.answers_so_far ?? s.answersCount + 1,
          }));
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          phase: "error",
          errorMessage: err instanceof Error ? err.message : "Failed to submit answer",
        }));
      }
    },
    [state.sessionId, state.phase],
  );

  const reset = useCallback(() => {
    clearStoredPersona();
    setState({
      phase: "idle",
      sessionId: null,
      currentQuestion: null,
      answersCount: 0,
      persona: null,
      errorMessage: null,
    });
  }, []);

  return { state, start, answer, reset };
}

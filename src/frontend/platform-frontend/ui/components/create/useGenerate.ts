import { useCallback, useReducer, useRef } from "react";
import { apiFetch } from "../../../core-logic/api";
import type { GenerationStep } from "./AppPreview";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedApp {
  slug: string;
  title: string;
  description: string;
  codespaceId: string;
  previewUrl: string;
  editorUrl: string;
  template: string;
  category: string;
  generatedAt: string;
  promptUsed: string;
}

export interface GenerationHistoryEntry {
  id: string;
  prompt: string;
  app: GeneratedApp;
  generatedAt: string;
}

type GenerateStatus = "idle" | "generating" | "success" | "error";

interface GenerateState {
  status: GenerateStatus;
  app: GeneratedApp | null;
  error: string | null;
  steps: GenerationStep[];
  history: GenerationHistoryEntry[];
}

type GenerateAction =
  | { type: "START" }
  | { type: "STEP_DONE"; stepIndex: number }
  | { type: "SUCCESS"; app: GeneratedApp; prompt: string }
  | { type: "ERROR"; error: string }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// LocalStorage persistence
// ---------------------------------------------------------------------------

const HISTORY_KEY = "spike-create-history";
const MAX_HISTORY = 20;

function loadHistory(): GenerationHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as GenerationHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(history: GenerationHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
}

function appendHistoryEntry(
  history: GenerationHistoryEntry[],
  app: GeneratedApp,
  prompt: string,
): GenerationHistoryEntry[] {
  const entry: GenerationHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    prompt,
    app,
    generatedAt: new Date().toISOString(),
  };
  const updated = [entry, ...history].slice(0, MAX_HISTORY);
  saveHistory(updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Initial steps
// ---------------------------------------------------------------------------

function makeInitialSteps(): GenerationStep[] {
  return [
    { label: "Classifying idea", done: false },
    { label: "Selecting template", done: false },
    { label: "Generating React code", done: false },
    { label: "Transpiling", done: false },
    { label: "Deploying to edge", done: false },
  ];
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function generateReducer(state: GenerateState, action: GenerateAction): GenerateState {
  switch (action.type) {
    case "START":
      return {
        ...state,
        status: "generating",
        app: null,
        error: null,
        steps: makeInitialSteps(),
      };

    case "STEP_DONE": {
      const steps = state.steps.map((s, i) =>
        i === action.stepIndex ? { ...s, done: true } : s,
      );
      return { ...state, steps };
    }

    case "SUCCESS": {
      const history = appendHistoryEntry(state.history, action.app, action.prompt);
      return {
        ...state,
        status: "success",
        app: action.app,
        error: null,
        steps: state.steps.map((s) => ({ ...s, done: true })),
        history,
      };
    }

    case "ERROR":
      return { ...state, status: "error", error: action.error };

    case "RESET":
      return { ...state, status: "idle", app: null, error: null, steps: makeInitialSteps() };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

interface GenerateApiResponse {
  slug?: string;
  title?: string;
  description?: string;
  codespaceId?: string;
  previewUrl?: string;
  editorUrl?: string;
  template?: string;
  category?: string;
  generatedAt?: string;
  promptUsed?: string;
  // Fallback fields from classify-only response
  status?: string;
  reason?: string;
}

function isGenerateApiResponse(value: unknown): value is GenerateApiResponse {
  return value !== null && typeof value === "object";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGenerate() {
  const [state, dispatch] = useReducer(generateReducer, {
    status: "idle",
    app: null,
    error: null,
    steps: makeInitialSteps(),
    history: loadHistory(),
  });

  // Track the current generation so we can cancel on unmount
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async ({ prompt, template }: { prompt: string; template?: string }) => {
      if (state.status === "generating") return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "START" });

      // Simulate step progression while the request is in-flight.
      // Steps 0-1 complete immediately; steps 2-4 complete as the request proceeds.
      const stepTimers: ReturnType<typeof setTimeout>[] = [];
      const stepDelays = [120, 450, 1400, 2800]; // ms delays for steps 0-3
      stepDelays.forEach((delay, i) => {
        stepTimers.push(setTimeout(() => dispatch({ type: "STEP_DONE", stepIndex: i }), delay));
      });

      try {
        const response = await apiFetch("/create/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, template }),
          signal: controller.signal,
        });

        // Clear all timers since the response arrived
        stepTimers.forEach(clearTimeout);

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          dispatch({ type: "ERROR", error: `Generation failed: ${response.status} ${errorText}` });
          return;
        }

        const raw: unknown = await response.json();
        if (!isGenerateApiResponse(raw)) {
          dispatch({ type: "ERROR", error: "Unexpected response format from generation API." });
          return;
        }

        // If the edge doesn't have a full generate endpoint yet, fall back to
        // constructing a preview URL from the classified slug so the UI still works.
        const slug = raw.slug ?? buildFallbackSlug(prompt);
        const edgeBase = "https://edge.spike.land";

        const app: GeneratedApp = {
          slug,
          title: raw.title ?? toDisplayName(slug),
          description: raw.description ?? prompt.slice(0, 200),
          codespaceId: raw.codespaceId ?? slug,
          previewUrl: raw.previewUrl ?? `${edgeBase}/live/${slug}/index.html`,
          editorUrl: raw.editorUrl ?? `/vibe-code?codeSpace=${slug}&prompt=${encodeURIComponent(prompt)}`,
          template: raw.template ?? template ?? "blank-react",
          category: raw.category ?? "app",
          generatedAt: raw.generatedAt ?? new Date().toISOString(),
          promptUsed: raw.promptUsed ?? prompt,
        };

        // Mark final step done before success
        dispatch({ type: "STEP_DONE", stepIndex: 4 });
        dispatch({ type: "SUCCESS", app, prompt });
      } catch (err) {
        stepTimers.forEach(clearTimeout);
        if (err instanceof Error && err.name === "AbortError") {
          dispatch({ type: "RESET" });
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        dispatch({ type: "ERROR", error: message });
      }
    },
    [state.status],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "RESET" });
  }, []);

  return {
    status: state.status,
    app: state.app,
    error: state.error,
    steps: state.steps,
    history: state.history,
    isGenerating: state.status === "generating",
    isSuccess: state.status === "success",
    generate,
    reset,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFallbackSlug(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join("-") || "new-app";
}

function toDisplayName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

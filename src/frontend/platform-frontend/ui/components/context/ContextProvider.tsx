/**
 * ContextProvider — user context: persona, session, feature flags, role.
 *
 * Usage:
 *   <ContextProvider featureFlagsUrl="/api/feature-flags">
 *     <App />
 *   </ContextProvider>
 *
 *   const { persona, flags, session, setPersona } = useAppContext();
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ── Persona types (mirrors OnboardingPersona from persona-data.ts) ──────────

export type PersonaSlug =
  | "ai-indie"
  | "classic-indie"
  | "agency-dev"
  | "in-house-dev"
  | "ml-engineer"
  | "ai-hobbyist"
  | "enterprise-devops"
  | "startup-devops"
  | "technical-founder"
  | "nontechnical-founder"
  | "growth-leader"
  | "ops-leader"
  | "content-creator"
  | "hobbyist-creator"
  | "social-gamer"
  | "solo-explorer";

export interface PersonaData {
  id: number;
  slug: PersonaSlug;
  name: string;
  description: string;
  heroText: string;
  cta: { label: string; href: string };
  recommendedAppSlugs: string[];
  defaultTheme: "light" | "dark" | "theme-soft-light" | "theme-deep-dark";
}

// ── Session ──────────────────────────────────────────────────────────────────

export type UserRole = "guest" | "user" | "pro" | "admin";

export interface SessionData {
  userId: string | null;
  isAuthenticated: boolean;
  role: UserRole;
  email: string | null;
  preferences: Record<string, unknown>;
}

// ── Feature Flags ────────────────────────────────────────────────────────────

export type FeatureFlags = Record<string, boolean>;

// ── Context shape ────────────────────────────────────────────────────────────

export interface AppContextValue {
  /** Current resolved persona (null = not yet determined) */
  persona: PersonaData | null;
  /** Raw slug stored in localStorage (may differ from persona if stale) */
  personaSlug: PersonaSlug | null;
  /** Set and persist persona slug */
  setPersona: (slug: PersonaSlug) => void;
  /** Clear stored persona (resets to null) */
  clearPersona: () => void;
  /** Feature flags loaded from API */
  flags: FeatureFlags;
  /** True while flags are being fetched */
  flagsLoading: boolean;
  /** Current auth/session state */
  session: SessionData;
  /** True while session is being resolved */
  sessionLoading: boolean;
  /** Override session role (for impersonation / dev) */
  setRole: (role: UserRole) => void;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SESSION: SessionData = {
  userId: null,
  isAuthenticated: false,
  role: "guest",
  email: null,
  preferences: {},
};

const DEFAULT_CONTEXT: AppContextValue = {
  persona: null,
  personaSlug: null,
  setPersona: () => undefined,
  clearPersona: () => undefined,
  flags: {},
  flagsLoading: false,
  session: DEFAULT_SESSION,
  sessionLoading: false,
  setRole: () => undefined,
};

// ── Context ──────────────────────────────────────────────────────────────────

export const AppContext = createContext<AppContextValue>(DEFAULT_CONTEXT);

// ── Storage key ──────────────────────────────────────────────────────────────

const PERSONA_STORAGE_KEY = "spike_persona_slug";

// ── Provider props ───────────────────────────────────────────────────────────

export interface ContextProviderProps {
  children: ReactNode;
  /**
   * URL for feature-flags API. Defaults to /api/feature-flags.
   * Set to null to skip fetching (useful in tests or SSR stubs).
   */
  featureFlagsUrl?: string | null;
  /**
   * URL for session API. Defaults to /api/auth/session.
   * Set to null to skip fetching.
   */
  sessionUrl?: string | null;
  /**
   * Optional initial persona slug (e.g. from server-side cookie).
   * Overrides localStorage only on first render if localStorage is empty.
   */
  initialPersonaSlug?: PersonaSlug | null;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ContextProvider({
  children,
  featureFlagsUrl = "/api/feature-flags",
  sessionUrl = "/api/auth/session",
  initialPersonaSlug = null,
}: ContextProviderProps) {
  // ── Persona ─────────────────────────────────────────────────────────────
  const [personaSlug, setPersonaSlugState] = useState<PersonaSlug | null>(() => {
    try {
      const stored = localStorage.getItem(PERSONA_STORAGE_KEY) as PersonaSlug | null;
      return stored ?? initialPersonaSlug;
    } catch {
      return initialPersonaSlug;
    }
  });

  const [allPersonas, setAllPersonas] = useState<PersonaData[]>([]);

  // Load persona definitions once from the API (or from a static bundle).
  // We use a lightweight endpoint that returns the PERSONAS array as JSON.
  useEffect(() => {
    fetch("/api/personas")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setAllPersonas(data as PersonaData[]);
        }
      })
      .catch(() => {
        // Silently degrade — components will use slug-only matching
      });
  }, []);

  const persona = useMemo<PersonaData | null>(() => {
    if (!personaSlug) return null;
    return allPersonas.find((p) => p.slug === personaSlug) ?? null;
  }, [personaSlug, allPersonas]);

  const setPersona = useCallback((slug: PersonaSlug) => {
    try {
      localStorage.setItem(PERSONA_STORAGE_KEY, slug);
    } catch {
      // localStorage unavailable (private mode / SSR)
    }
    setPersonaSlugState(slug);
  }, []);

  const clearPersona = useCallback(() => {
    try {
      localStorage.removeItem(PERSONA_STORAGE_KEY);
    } catch {
      // ignore
    }
    setPersonaSlugState(null);
  }, []);

  // ── Feature flags ────────────────────────────────────────────────────────
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [flagsLoading, setFlagsLoading] = useState(featureFlagsUrl !== null);

  useEffect(() => {
    if (!featureFlagsUrl) {
      setFlagsLoading(false);
      return;
    }

    let cancelled = false;
    setFlagsLoading(true);

    fetch(featureFlagsUrl, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: unknown) => {
        if (!cancelled && data !== null && typeof data === "object" && !Array.isArray(data)) {
          setFlags(data as FeatureFlags);
        }
      })
      .catch(() => {
        // Feature flags unavailable — continue with empty set
      })
      .finally(() => {
        if (!cancelled) setFlagsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [featureFlagsUrl]);

  // ── Session ──────────────────────────────────────────────────────────────
  const [session, setSession] = useState<SessionData>(DEFAULT_SESSION);
  const [sessionLoading, setSessionLoading] = useState(sessionUrl !== null);

  useEffect(() => {
    if (!sessionUrl) {
      setSessionLoading(false);
      return;
    }

    let cancelled = false;
    setSessionLoading(true);

    fetch(sessionUrl, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        if (data !== null && typeof data === "object" && !Array.isArray(data)) {
          const d = data as Record<string, unknown>;
          setSession({
            userId: typeof d.userId === "string" ? d.userId : null,
            isAuthenticated: Boolean(d.isAuthenticated ?? d.authenticated),
            role: (d.role as UserRole) ?? "user",
            email: typeof d.email === "string" ? d.email : null,
            preferences:
              d.preferences !== null &&
              typeof d.preferences === "object" &&
              !Array.isArray(d.preferences)
                ? (d.preferences as Record<string, unknown>)
                : {},
          });
        }
      })
      .catch(() => {
        // Session endpoint unavailable — keep as guest
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionUrl]);

  const setRole = useCallback((role: UserRole) => {
    setSession((prev) => ({ ...prev, role }));
  }, []);

  // ── Sync persona with session (auto-load from user profile) ─────────────
  useEffect(() => {
    if (session.isAuthenticated && !personaSlug) {
      // If authenticated but no local persona, try to load from user preferences
      const savedSlug = session.preferences["personaSlug"] as PersonaSlug | undefined;
      if (savedSlug) {
        setPersonaSlugState(savedSlug);
      }
    }
  }, [session.isAuthenticated, session.preferences, personaSlug]);

  const value = useMemo<AppContextValue>(
    () => ({
      persona,
      personaSlug,
      setPersona,
      clearPersona,
      flags,
      flagsLoading,
      session,
      sessionLoading,
      setRole,
    }),
    [
      persona,
      personaSlug,
      setPersona,
      clearPersona,
      flags,
      flagsLoading,
      session,
      sessionLoading,
      setRole,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAppContext(): AppContextValue {
  return useContext(AppContext);
}

/** Narrow hook — only persona state */
export function usePersona() {
  const { persona, personaSlug, setPersona, clearPersona } = useAppContext();
  return { persona, personaSlug, setPersona, clearPersona };
}

/** Narrow hook — only feature flags */
export function useFeatureFlags() {
  const { flags, flagsLoading } = useAppContext();
  return { flags, flagsLoading, hasFlag: (key: string) => flags[key] === true };
}

/** Narrow hook — only session */
export function useSession() {
  const { session, sessionLoading, setRole } = useAppContext();
  return { session, sessionLoading, setRole };
}

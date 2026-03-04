import {
  createContext,
  createElement,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface WidgetVariantConfig {
  defaultSliderIdx: number;
  ctaText: string;
  ctaColor: string;
  showSocialProof: boolean;
  socialProofStyle: "exact" | "fuzzy" | "recent" | "hidden";
}

interface ExperimentAssignment {
  variantId: string;
  config: Record<string, unknown>;
}

interface ExperimentContextValue {
  assignments: Record<string, ExperimentAssignment>;
  config: WidgetVariantConfig;
  loading: boolean;
  getVariant: (experimentId: string) => string | null;
}

const DEFAULT_CONFIG: WidgetVariantConfig = {
  defaultSliderIdx: 3,
  ctaText: "Donate ${amount}",
  ctaColor: "#10b981",
  showSocialProof: true,
  socialProofStyle: "exact",
};

const CACHE_KEY = "exp_assignments";
const CLIENT_ID_KEY = "spike_client_id";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  timestamp: number;
  data: Record<string, ExperimentAssignment>;
}

function getOrCreateClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;

    const newId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, newId);
    return newId;
  } catch {
    return crypto.randomUUID();
  }
}

function readCache(): Record<string, ExperimentAssignment> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const entry: CacheEntry = JSON.parse(raw) as CacheEntry;
    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(data: Record<string, ExperimentAssignment>): void {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Storage quota exceeded or unavailable — silently skip
  }
}

function mergeConfigs(
  assignments: Record<string, ExperimentAssignment>,
): WidgetVariantConfig {
  let merged: WidgetVariantConfig = { ...DEFAULT_CONFIG };

  for (const assignment of Object.values(assignments)) {
    const cfg = assignment.config as Partial<WidgetVariantConfig>;

    if (cfg.defaultSliderIdx !== undefined) {
      merged.defaultSliderIdx = cfg.defaultSliderIdx;
    }
    if (cfg.ctaText !== undefined) {
      merged.ctaText = cfg.ctaText;
    }
    if (cfg.ctaColor !== undefined) {
      merged.ctaColor = cfg.ctaColor;
    }
    if (cfg.showSocialProof !== undefined) {
      merged.showSocialProof = cfg.showSocialProof;
    }
    if (cfg.socialProofStyle !== undefined) {
      merged.socialProofStyle = cfg.socialProofStyle;
    }
  }

  return merged;
}

const ExperimentContext = createContext<ExperimentContextValue>({
  assignments: {},
  config: DEFAULT_CONFIG,
  loading: true,
  getVariant: () => null,
});

export function ExperimentProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [assignments, setAssignments] = useState<
    Record<string, ExperimentAssignment>
  >({});
  const [config, setConfig] = useState<WidgetVariantConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignments() {
      const cached = readCache();
      if (cached) {
        if (!cancelled) {
          setAssignments(cached);
          setConfig(mergeConfigs(cached));
          setLoading(false);
        }
        return;
      }

      const clientId = getOrCreateClientId();

      try {
        const response = await fetch("/api/experiments/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });

        if (!response.ok) {
          throw new Error(`Experiment assign failed: ${response.status}`);
        }

        const data = (await response.json()) as {
          assignments: Record<string, ExperimentAssignment>;
        };

        if (!cancelled) {
          const a = data.assignments ?? {};
          writeCache(a);
          setAssignments(a);
          setConfig(mergeConfigs(a));
        }
      } catch {
        // Fall back to defaults on error — do not surface to UI
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAssignments();

    return () => {
      cancelled = true;
    };
  }, []);

  const getVariant = useCallback(
    (experimentId: string): string | null => {
      return assignments[experimentId]?.variantId ?? null;
    },
    [assignments],
  );

  return createElement(
    ExperimentContext.Provider,
    { value: { assignments, config, loading, getVariant } },
    children,
  );
}

export function useExperiment(): ExperimentContextValue {
  const ctx = useContext(ExperimentContext);
  if (ctx === undefined) {
    throw new Error("useExperiment must be used within an ExperimentProvider");
  }
  return ctx;
}

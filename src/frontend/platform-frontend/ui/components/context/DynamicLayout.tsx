/**
 * DynamicLayout — persona-driven section reordering.
 *
 * Sections are identified by string keys and rendered in a persona-specific
 * priority order. Unlisted sections always appear after the prioritized ones.
 *
 * Usage:
 *   <DynamicLayout
 *     sections={{
 *       tools:        <ToolsSection />,
 *       tutorials:    <TutorialsSection />,
 *       featured:     <FeaturedAppsSection />,
 *       categories:   <CategoriesSection />,
 *       create:       <CreatePromptSection />,
 *       inspiration:  <InspirationSection />,
 *       dashboard:    <DashboardSection />,
 *       dataTools:    <DataToolsSection />,
 *     }}
 *   />
 *
 * Built-in orderings (all configurable via `overrides`):
 *   builder personas   → tools, tutorials, …rest
 *   explorer personas  → featured, categories, …rest
 *   creator personas   → create, inspiration, …rest
 *   analyst personas   → dashboard, dataTools, …rest
 *   default / unknown  → insertion order of `sections`
 */

import { useMemo, type ReactNode } from "react";
import { usePersona, type PersonaSlug } from "./ContextProvider";

// ── Types ────────────────────────────────────────────────────────────────────

export type SectionKey = string;

export type SectionOrder = SectionKey[];

export type PersonaGroupKey = "builder" | "explorer" | "creator" | "analyst" | "default";

/** Maps persona slugs to a layout group */
const PERSONA_GROUP_MAP: Record<PersonaSlug, PersonaGroupKey> = {
  "ai-indie": "builder",
  "classic-indie": "builder",
  "agency-dev": "builder",
  "in-house-dev": "builder",
  "ml-engineer": "analyst",
  "ai-hobbyist": "explorer",
  "enterprise-devops": "analyst",
  "startup-devops": "builder",
  "technical-founder": "builder",
  "nontechnical-founder": "creator",
  "growth-leader": "analyst",
  "ops-leader": "analyst",
  "content-creator": "creator",
  "hobbyist-creator": "creator",
  "social-gamer": "explorer",
  "solo-explorer": "explorer",
};

/** Built-in section orderings per group */
const DEFAULT_GROUP_ORDER: Record<PersonaGroupKey, SectionOrder> = {
  builder: ["tools", "tutorials"],
  explorer: ["featured", "categories"],
  creator: ["create", "inspiration"],
  analyst: ["dashboard", "dataTools"],
  default: [],
};

export interface DynamicLayoutProps {
  /** Map of section key → ReactNode */
  sections: Record<SectionKey, ReactNode>;
  /**
   * Override the default section order for specific persona groups.
   * Only the keys provided here are overridden; others keep their defaults.
   */
  overrides?: Partial<Record<PersonaGroupKey, SectionOrder>>;
  /** Tailwind / CSS class applied to the root container */
  className?: string;
  /** Tailwind / CSS class applied to each section wrapper */
  sectionClassName?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DynamicLayout({
  sections,
  overrides = {},
  className = "flex flex-col gap-6",
  sectionClassName = "",
}: DynamicLayoutProps) {
  const { personaSlug } = usePersona();

  const orderedKeys = useMemo(() => {
    const group: PersonaGroupKey =
      (personaSlug !== null ? PERSONA_GROUP_MAP[personaSlug] : undefined) ?? "default";

    const priorityOrder: SectionOrder = overrides[group] ?? DEFAULT_GROUP_ORDER[group];

    // Build final order: prioritized keys first, then remaining in insertion order
    const remaining = Object.keys(sections).filter((k) => !priorityOrder.includes(k));
    const ordered = [...priorityOrder.filter((k) => k in sections), ...remaining];

    return ordered;
  }, [personaSlug, sections, overrides]);

  return (
    <div className={className}>
      {orderedKeys.map((key) => (
        <div key={key} className={sectionClassName} data-section={key}>
          {sections[key]}
        </div>
      ))}
    </div>
  );
}

// ── Helper: useLayoutGroup ────────────────────────────────────────────────────

/**
 * Returns the layout group key for the current persona.
 * Useful for conditional styling at the route level.
 */
export function useLayoutGroup(): PersonaGroupKey {
  const { personaSlug } = usePersona();
  return (personaSlug !== null ? PERSONA_GROUP_MAP[personaSlug] : undefined) ?? "default";
}

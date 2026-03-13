/**
 * ConditionalBlock — content gate driven by ContextProvider state.
 *
 * Usage examples:
 *
 *   // Single condition (show only for builders)
 *   <ConditionalBlock when={{ persona: "ai-indie" }}>
 *     <BuilderOnlyContent />
 *   </ConditionalBlock>
 *
 *   // Feature flag gate
 *   <ConditionalBlock when={{ flag: "beta-features" }}>
 *     <BetaPanel />
 *   </ConditionalBlock>
 *
 *   // Role-based access
 *   <ConditionalBlock when={{ role: "admin" }}>
 *     <AdminDashboard />
 *   </ConditionalBlock>
 *
 *   // Exclusion (show for everyone EXCEPT explorers)
 *   <ConditionalBlock unless={{ persona: "solo-explorer" }}>
 *     <AdvancedSection />
 *   </ConditionalBlock>
 *
 *   // AND logic (all conditions must pass)
 *   <ConditionalBlock when={{ role: "pro", flag: "beta-features" }} logic="and">
 *     <ProBetaPanel />
 *   </ConditionalBlock>
 *
 *   // OR logic (any condition passes)
 *   <ConditionalBlock when={[{ persona: "ai-indie" }, { persona: "ml-engineer" }]} logic="or">
 *     <AISection />
 *   </ConditionalBlock>
 *
 *   // Fallback for non-matching visitors
 *   <ConditionalBlock when={{ persona: "content-creator" }} fallback={<PublicHero />}>
 *     <CreatorHero />
 *   </ConditionalBlock>
 */

import { type ReactNode } from "react";
import { useAppContext, type PersonaSlug, type UserRole } from "./ContextProvider";

// ── Condition types ──────────────────────────────────────────────────────────

/**
 * A single condition object.
 * All provided keys are ANDed (when logic="and") or ORed (when logic="or").
 */
export interface Condition {
  /** Match a specific persona slug */
  persona?: PersonaSlug;
  /** Match any of the listed persona slugs */
  personas?: PersonaSlug[];
  /** Feature flag must be enabled */
  flag?: string;
  /** All listed feature flags must be enabled */
  flags?: string[];
  /** User role must match exactly */
  role?: UserRole;
  /** User role must be in this list */
  roles?: UserRole[];
  /** Session must be authenticated */
  authenticated?: boolean;
}

export type ConditionInput = Condition | Condition[];

// ── Props ────────────────────────────────────────────────────────────────────

export interface ConditionalBlockProps {
  /** Condition(s) that must pass to render children */
  when?: ConditionInput;
  /** Condition(s) that, if matched, hide children (inverse of when) */
  unless?: ConditionInput;
  /**
   * How multiple condition objects in an array are combined.
   * "and" = all must pass, "or" = any must pass.
   * Defaults to "or" when ConditionInput is an array, "and" when it is a single object.
   */
  logic?: "and" | "or";
  children: ReactNode;
  /** Content rendered when children are hidden */
  fallback?: ReactNode;
}

// ── Evaluator ────────────────────────────────────────────────────────────────

function evaluateSingleCondition(
  condition: Condition,
  ctx: {
    personaSlug: PersonaSlug | null;
    flags: Record<string, boolean>;
    role: UserRole;
    isAuthenticated: boolean;
  },
): boolean {
  const results: boolean[] = [];

  if (condition.persona !== undefined) {
    results.push(ctx.personaSlug === condition.persona);
  }

  if (condition.personas !== undefined) {
    results.push(ctx.personaSlug !== null && condition.personas.includes(ctx.personaSlug));
  }

  if (condition.flag !== undefined) {
    results.push(ctx.flags[condition.flag] === true);
  }

  if (condition.flags !== undefined) {
    results.push(condition.flags.every((f) => ctx.flags[f] === true));
  }

  if (condition.role !== undefined) {
    results.push(ctx.role === condition.role);
  }

  if (condition.roles !== undefined) {
    results.push(condition.roles.includes(ctx.role));
  }

  if (condition.authenticated !== undefined) {
    results.push(ctx.isAuthenticated === condition.authenticated);
  }

  // Empty condition object — trivially passes (acts as no-op gate)
  if (results.length === 0) return true;

  // Within a single Condition object keys are always ANDed
  return results.every(Boolean);
}

function evaluateConditions(
  input: ConditionInput,
  logic: "and" | "or",
  ctx: Parameters<typeof evaluateSingleCondition>[1],
): boolean {
  const conditions = Array.isArray(input) ? input : [input];
  const results = conditions.map((c) => evaluateSingleCondition(c, ctx));
  return logic === "and" ? results.every(Boolean) : results.some(Boolean);
}

// ── Component ────────────────────────────────────────────────────────────────

export function ConditionalBlock({
  when,
  unless,
  logic,
  children,
  fallback = null,
}: ConditionalBlockProps) {
  const { personaSlug, flags, session } = useAppContext();

  const ctx = {
    personaSlug,
    flags,
    role: session.role,
    isAuthenticated: session.isAuthenticated,
  };

  // Default logic: "or" for arrays, "and" for single objects
  function resolveLogic(input: ConditionInput): "and" | "or" {
    if (logic !== undefined) return logic;
    return Array.isArray(input) ? "or" : "and";
  }

  let visible = true;

  if (when !== undefined) {
    visible = visible && evaluateConditions(when, resolveLogic(when), ctx);
  }

  if (unless !== undefined) {
    visible = visible && !evaluateConditions(unless, resolveLogic(unless), ctx);
  }

  return <>{visible ? children : fallback}</>;
}

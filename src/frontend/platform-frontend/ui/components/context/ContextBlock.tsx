/**
 * ContextBlock — React component backing the <context-block> MDX directive.
 *
 * Used inside MDX content to show/hide sections based on persona, role, or
 * feature flags. Consumed by MdxSurface via the custom components map.
 *
 * MDX usage (via rehype-raw or custom directive):
 *
 *   <context-block persona="ai-indie">
 *     This text is only visible to AI Indie builders.
 *   </context-block>
 *
 *   <context-block personas="ai-indie,ml-engineer">
 *     For AI folks only.
 *   </context-block>
 *
 *   <context-block flag="beta-features">
 *     Beta content here.
 *   </context-block>
 *
 *   <context-block role="admin">
 *     Admin-only section.
 *   </context-block>
 *
 *   <context-block unless-persona="solo-explorer">
 *     Hidden from casual explorers.
 *   </context-block>
 *
 * All attribute values are strings (HTML attributes), so commas are used to
 * delimit multi-value attributes.
 */

import { type ReactNode } from "react";
import { ConditionalBlock } from "./ConditionalBlock";
import type { Condition, PersonaSlug, UserRole } from "./ContextProvider";

// ── Props (HTML-attribute-friendly strings) ──────────────────────────────────

export interface ContextBlockProps {
  /** Single persona slug */
  persona?: string;
  /** Comma-separated persona slugs */
  personas?: string;
  /** Single feature flag key */
  flag?: string;
  /** Comma-separated feature flag keys */
  flags?: string;
  /** Role string */
  role?: string;
  /** Comma-separated role strings */
  roles?: string;
  /** If set to "true", require authenticated session */
  authenticated?: string;
  // Exclusion variants (unless-*)
  "unless-persona"?: string;
  "unless-personas"?: string;
  "unless-flag"?: string;
  "unless-flags"?: string;
  "unless-role"?: string;
  "unless-roles"?: string;
  children?: ReactNode;
  /** HTML content passed through rehype-raw as string */
  dangerouslySetInnerHTML?: { __html: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function splitCsv<T>(value: string | undefined): T[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? (parts as T[]) : undefined;
}

function buildCondition(props: ContextBlockProps, prefix: "" | "unless-"): Condition | undefined {
  const p = prefix;
  const personaAttr = props[`${p}persona` as keyof ContextBlockProps] as string | undefined;
  const personasAttr = props[`${p}personas` as keyof ContextBlockProps] as string | undefined;
  const flagAttr = props[`${p}flag` as keyof ContextBlockProps] as string | undefined;
  const flagsAttr = props[`${p}flags` as keyof ContextBlockProps] as string | undefined;
  const roleAttr = props[`${p}role` as keyof ContextBlockProps] as string | undefined;
  const rolesAttr = props[`${p}roles` as keyof ContextBlockProps] as string | undefined;

  const condition: Condition = {};
  let hasKey = false;

  if (personaAttr) {
    condition.persona = personaAttr as PersonaSlug;
    hasKey = true;
  }
  const parsedPersonas = splitCsv<PersonaSlug>(personasAttr);
  if (parsedPersonas) {
    condition.personas = parsedPersonas;
    hasKey = true;
  }
  if (flagAttr) {
    condition.flag = flagAttr;
    hasKey = true;
  }
  const parsedFlags = splitCsv<string>(flagsAttr);
  if (parsedFlags) {
    condition.flags = parsedFlags;
    hasKey = true;
  }
  if (roleAttr) {
    condition.role = roleAttr as UserRole;
    hasKey = true;
  }
  const parsedRoles = splitCsv<UserRole>(rolesAttr);
  if (parsedRoles) {
    condition.roles = parsedRoles;
    hasKey = true;
  }
  // `authenticated` only applies on the `when` side
  if (prefix === "" && props.authenticated !== undefined) {
    condition.authenticated = props.authenticated === "true";
    hasKey = true;
  }

  return hasKey ? condition : undefined;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ContextBlock(props: ContextBlockProps) {
  const whenCondition = buildCondition(props, "");
  const unlessCondition = buildCondition(props, "unless-");

  // If no conditions provided, render children unconditionally
  if (!whenCondition && !unlessCondition) {
    return <>{props.children}</>;
  }

  return (
    <ConditionalBlock when={whenCondition} unless={unlessCondition}>
      {props.children}
    </ConditionalBlock>
  );
}

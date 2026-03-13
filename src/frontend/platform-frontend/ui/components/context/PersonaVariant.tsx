/**
 * PersonaVariant — render different content per persona with crossfade.
 *
 * Usage:
 *   <PersonaVariant
 *     variants={{
 *       "ai-indie":   <AIIndieHero />,
 *       "ml-engineer": <MLHero />,
 *       default:      <DefaultHero />,
 *     }}
 *   />
 *
 * Rules:
 * - `default` key is always required as the fallback.
 * - When persona is null or not listed, `default` is shown.
 * - Persona change triggers a CSS crossfade (opacity transition).
 * - Pass `transition={false}` to skip animation.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePersona, type PersonaSlug } from "./ContextProvider";

// ── Types ────────────────────────────────────────────────────────────────────

export type PersonaVariantMap = Partial<Record<PersonaSlug, ReactNode>> & {
  default: ReactNode;
};

export interface PersonaVariantProps {
  variants: PersonaVariantMap;
  /** Duration of the crossfade in ms. Defaults to 200. Pass 0 to disable. */
  transitionDuration?: number;
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PersonaVariant({
  variants,
  transitionDuration = 200,
  className = "",
}: PersonaVariantProps) {
  const { personaSlug } = usePersona();

  const activeContent: ReactNode =
    (personaSlug !== null && variants[personaSlug] !== undefined
      ? variants[personaSlug]
      : undefined) ?? variants.default;

  // Track previous content to trigger fade-out / fade-in on persona change
  const [displayed, setDisplayed] = useState<ReactNode>(activeContent);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSlugRef = useRef<PersonaSlug | null>(personaSlug);

  useEffect(() => {
    if (personaSlug === prevSlugRef.current) return;
    prevSlugRef.current = personaSlug;

    if (transitionDuration === 0) {
      setDisplayed(activeContent);
      return;
    }

    // Start fade-out
    setFading(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Swap content at the midpoint (fully transparent), then fade back in
      setDisplayed(activeContent);
      setFading(false);
    }, transitionDuration / 2);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [personaSlug, activeContent, transitionDuration]);

  const style =
    transitionDuration > 0
      ? {
          opacity: fading ? 0 : 1,
          transition: `opacity ${transitionDuration / 2}ms ease-in-out`,
        }
      : undefined;

  return (
    <div className={className} style={style}>
      {displayed}
    </div>
  );
}

// ── Utility: build variant map from an array ──────────────────────────────────

/**
 * Helper for building variant maps when you want to share content across
 * several persona slugs without repeating JSX.
 *
 * Example:
 *   buildVariants([
 *     { slugs: ["ai-indie", "ml-engineer"], node: <TechHero /> },
 *     { slugs: ["content-creator", "hobbyist-creator"], node: <CreativeHero /> },
 *   ], <DefaultHero />)
 */
export function buildVariants(
  entries: { slugs: PersonaSlug[]; node: ReactNode }[],
  defaultNode: ReactNode,
): PersonaVariantMap {
  const map: PersonaVariantMap = { default: defaultNode };
  for (const { slugs, node } of entries) {
    for (const slug of slugs) {
      map[slug] = node;
    }
  }
  return map;
}

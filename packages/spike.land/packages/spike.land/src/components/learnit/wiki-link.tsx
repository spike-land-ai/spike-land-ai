"use client";

import { slugify } from "@/lib/learnit/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface WikiLinkProps {
  topic: string; // The raw topic text, e.g. "React Hooks"
  alias?: string; // Optional display text
  className?: string;
}

export function WikiLink({ topic, alias, className }: WikiLinkProps) {
  const slug = slugify(topic);
  const href = `/learnit/${slug}`;
  const displayText = alias || topic;

  return (
    <Link
      href={href}
      className={cn(
        "text-amber-500 hover:underline font-medium decoration-amber-500/30 underline-offset-4",
        "transition-colors hover:decoration-amber-500 hover:text-amber-400",
        className,
      )}
    >
      {displayText}
    </Link>
  );
}

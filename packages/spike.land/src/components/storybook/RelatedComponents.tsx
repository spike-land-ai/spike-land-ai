"use client";

import { Link } from "@/components/ui/link";
import { storybookIconMap, storybookSections } from "./constants";

interface RelatedComponentsProps {
  currentId: string;
}

export function RelatedComponents({ currentId }: RelatedComponentsProps) {
  const currentSection = storybookSections.find((s) => s.id === currentId);

  if (!currentSection) return null;

  const relatedSections = storybookSections.filter(
    (s) => s.category === currentSection.category && s.id !== currentId,
  );

  if (relatedSections.length === 0) return null;

  return (
    <div className="mt-16 space-y-4">
      <h2 className="text-lg font-semibold font-heading text-muted-foreground uppercase tracking-wider text-sm">
        Related Components
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:overflow-visible md:pb-0">
        {relatedSections.map((section) => {
          const IconComponent = storybookIconMap[section.icon as keyof typeof storybookIconMap];
          return (
            <Link
              key={section.id}
              href={`/storybook/${section.id}`}
              className="flex-shrink-0 w-48 md:w-auto group block p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                {IconComponent && (
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0 group-hover:bg-primary/20 transition-colors duration-200">
                    <IconComponent className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200 truncate">
                    {section.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                    {section.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

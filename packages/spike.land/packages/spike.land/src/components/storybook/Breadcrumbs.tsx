"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { usePathname } from "next/navigation";
import { storybookSections } from "./constants";

export function Breadcrumbs() {
  const pathname = usePathname();

  // Extract the section id from the URL path: /storybook/[id] or /storybook/[id]/...
  const segments = pathname.split("/").filter(Boolean);
  const storybookIndex = segments.indexOf("storybook");
  const sectionId = storybookIndex >= 0
    ? segments[storybookIndex + 1]
    : undefined;

  const currentSection = storybookSections.find(s => s.id === sectionId);

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList className="text-sm">
        <BreadcrumbItem>
          <BreadcrumbLink
            href="/storybook"
            className="text-muted-foreground/70 hover:text-muted-foreground transition-colors"
          >
            Design System
          </BreadcrumbLink>
        </BreadcrumbItem>
        {currentSection && (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <span className="text-muted-foreground/50 text-sm">
                {currentSection.category}
              </span>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-sm font-medium">
                {currentSection.label}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

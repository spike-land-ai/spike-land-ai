"use client";

import { shouldHideFooter } from "@/lib/layout/excluded-routes";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function FooterVisibility({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (shouldHideFooter(pathname)) {
    return null;
  }
  return <>{children}</>;
}

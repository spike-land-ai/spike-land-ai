"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useAbTest as useAbTestHook } from "@/hooks/useAbTest";

interface AbTestContextValue {
  variant: string | null;
  isLoading: boolean;
}

const AbTestContext = createContext<AbTestContextValue>({
  variant: null,
  isLoading: true,
});

export function useAbTest() {
  return useContext(AbTestContext);
}

interface AbTestProviderProps {
  testId: string;
  visitorId: string;
  children: ReactNode;
}

/**
 * React Context provider for A/B testing.
 * All cookie/API logic lives in @/lib/ab-test/assignment.
 */
export function AbTestProvider({
  testId,
  visitorId,
  children,
}: AbTestProviderProps) {
  const { variant, isLoading } = useAbTestHook(testId, visitorId);

  return (
    <AbTestContext.Provider value={{ variant, isLoading }}>
      {children}
    </AbTestContext.Provider>
  );
}

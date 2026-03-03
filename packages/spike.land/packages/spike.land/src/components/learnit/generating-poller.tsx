"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function GeneratingPoller() {
  const router = useRouter();
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 3000);
    const timeout = setTimeout(() => clearInterval(interval), 120000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [router]);
  return null;
}

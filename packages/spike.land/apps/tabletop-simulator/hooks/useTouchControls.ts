"use client";
import { useState } from "react";

export type TouchMode = "orbit" | "interaction";

export function useTouchControls() {
  const [mode, setMode] = useState<TouchMode>("orbit");

  const toggleMode = () => setMode((p) => (p === "orbit" ? "interaction" : "orbit"));

  return { mode, toggleMode };
}

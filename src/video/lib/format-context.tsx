import React, { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";
import type { VideoFormat } from "./schemas";

type FormatContextType = {
  format: VideoFormat;
};

const FormatContext = createContext<FormatContextType | undefined>(undefined);

const getFormat = (width: number, height: number): VideoFormat => {
  if (width === height) return "square";
  if (height > width) return "portrait";
  return "landscape";
};

export const FormatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const format = getFormat(width, height);

  return <FormatContext.Provider value={{ format }}>{children}</FormatContext.Provider>;
};

export const useFormat = () => {
  const context = useContext(FormatContext);
  if (context === undefined) {
    throw new Error("useFormat must be used within a FormatProvider");
  }
  return context.format;
};

export function formatValue<T>(
  format: VideoFormat,
  values: { landscape: T; portrait: T; square: T },
): T {
  return values[format];
}

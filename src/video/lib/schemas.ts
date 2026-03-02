import { z } from "zod";

export const VideoFormatSchema = z.enum(["landscape", "portrait", "square"]);
export type VideoFormat = z.infer<typeof VideoFormatSchema>;

export const FORMAT_CONFIGS: Record<VideoFormat, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

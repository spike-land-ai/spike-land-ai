import type { EnhancedImage, ImageEnhancementJob, User } from "@prisma/client";

export interface PublicImage extends EnhancedImage {
  enhancementJobs: ImageEnhancementJob[];
  user: Pick<User, "name" | "image">;
}

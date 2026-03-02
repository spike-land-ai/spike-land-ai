import type { UserRole } from "@prisma/client";

export interface Session {
  user?: {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    role?: UserRole | string;
  };
}

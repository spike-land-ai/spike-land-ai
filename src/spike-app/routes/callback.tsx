import { Navigate } from "@tanstack/react-router";

export function CallbackPage() {
  // Better Auth handles OAuth callbacks server-side at /api/auth/callback/{provider}
  return <Navigate to="/" />;
}

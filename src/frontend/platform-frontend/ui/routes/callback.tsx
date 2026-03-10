import { useEffect } from "react";
import { Navigate } from "@tanstack/react-router";
import { trackAnalyticsEvent } from "../hooks/useAnalytics";
import { useAuth } from "../hooks/useAuth";
import { trackSignUpConversion } from "../../core-logic/google-ads";

export function CallbackPage() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      trackAnalyticsEvent("signup_completed");
      trackSignUpConversion();
    }
  }, [isAuthenticated]);

  // Better Auth handles OAuth callbacks server-side at /api/auth/callback/{provider}
  return <Navigate to="/" />;
}

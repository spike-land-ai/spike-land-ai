import { useAuth } from "react-oidc-context";
import { Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function CallbackPage() {
  const auth = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (auth.error) {
      setErrorMsg(auth.error.message);
    }
  }, [auth.error]);

  // Already authenticated — redirect to origin or home
  if (auth.isAuthenticated) {
    const returnUrl =
      (auth.user?.state as { returnUrl?: string })?.returnUrl ?? "/";
    return <Navigate to={returnUrl} />;
  }

  // Error state
  if (errorMsg) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-red-600">
            Authentication Error
          </h1>
          <p className="text-sm text-gray-500">{errorMsg}</p>
          <button
            onClick={() => {
              setErrorMsg(null);
              auth.signinRedirect();
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Loading / processing
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm text-gray-500">Completing sign in...</p>
      </div>
    </div>
  );
}

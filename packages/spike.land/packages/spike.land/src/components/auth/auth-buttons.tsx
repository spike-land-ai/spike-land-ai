"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth/client/actions";
import { getProviders } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

// Google "G" logo SVG
function GoogleIcon({ className }: { className?: string; }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// GitHub logo SVG
function GitHubIcon({ className }: { className?: string; }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

// Apple logo SVG
function AppleIcon({ className }: { className?: string; }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282" />
    </svg>
  );
}

type AuthStep = "email" | "password" | "signup" | "oauth-only";

interface AuthButtonsProps {
  className?: string;
}

interface EmailCheckResponse {
  exists: boolean;
  hasPassword: boolean;
  error?: string;
}

export function AuthButtons({ className }: AuthButtonsProps) {
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [availableProviders, setAvailableProviders] = useState<Set<string> | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);

  useEffect(() => {
    getProviders()
      .then(providers => {
        setAvailableProviders(new Set(Object.keys(providers ?? {})));
      })
      .catch(() => {
        // On error, set null to indicate fallback (show all buttons)
        setAvailableProviders(null);
      })
      .finally(() => {
        setIsLoadingProviders(false);
      });
  }, []);

  useEffect(() => {
    if (step === "password" || step === "signup") {
      passwordInputRef.current?.focus();
    }
  }, [step]);

  const getCallbackUrl = (): string => {
    if (typeof window === "undefined") return "/";
    const params = new URLSearchParams(window.location.search);
    const callbackUrl = params.get("callbackUrl") || "/";
    // Validate URL to prevent open redirect attacks
    try {
      const url = new URL(callbackUrl, window.location.origin);
      if (url.origin === window.location.origin) {
        return url.pathname + url.search;
      }
    } catch {
      // Malformed URL; use default
    }
    return "/";
  };

  const checkEmail = async (): Promise<EmailCheckResponse | null> => {
    try {
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to check email");
        return null;
      }

      return data as EmailCheckResponse;
    } catch (err) {
      console.error("Email check error:", err);
      setError("An error occurred. Please try again.");
      return null;
    }
  };

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsCheckingEmail(true);
    setError(null);

    const result = await checkEmail();

    setIsCheckingEmail(false);

    if (!result) return;

    if (result.exists) {
      if (result.hasPassword) {
        // User exists with password - show password field
        setStep("password");
      } else {
        // User exists but no password (OAuth only)
        setStep("oauth-only");
      }
    } else {
      // New user - show signup form with password
      setStep("signup");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else if (result?.ok) {
        // Redirect to callback URL or Orbit on success
        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get("callbackUrl") || "/";

        // Validate URL to prevent open redirect attacks
        let safeUrl = "/";
        try {
          // Only allow same-origin absolute URLs or relative paths
          const url = new URL(callbackUrl, window.location.origin);
          if (url.origin === window.location.origin) {
            safeUrl = url.href;
          }
        } catch {
          // Malformed URL; use default
        }
        window.location.href = safeUrl;
      }
    } catch (err) {
      console.error("Sign in error:", err);
      setError("An error occurred during sign in");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // First, create the account via the signup API
      const signupResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const signupData = await signupResponse.json();

      if (!signupResponse.ok) {
        setError(
          signupData.error
            || "Unable to create account. Please try signing in with Google or GitHub.",
        );
        return;
      }

      // Account created successfully, now sign in with credentials
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        // Account was created but signin failed - unusual but handle it
        setError(
          "Account created but sign in failed. Please try signing in again.",
        );
      } else if (result?.ok) {
        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get("callbackUrl") || "/";

        let safeUrl = "/";
        try {
          const url = new URL(callbackUrl, window.location.origin);
          if (url.origin === window.location.origin) {
            safeUrl = url.href;
          }
        } catch {
          // Malformed URL; use default
        }
        window.location.href = safeUrl;
      }
    } catch (err) {
      console.error("Sign up error:", err);
      setError("An error occurred during sign up");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setPassword("");
    setError(null);
  };

  const renderEmailStep = () => (
    <form
      onSubmit={handleEmailContinue}
      className="space-y-4"
      autoComplete="off"
    >
      <div className="space-y-2">
        <Input
          id="email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={isCheckingEmail}
          className="h-12"
          autoComplete="username"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground text-center mb-2">
        We'll send you a sign-in link.
      </p>
      <Button
        type="submit"
        className="w-full shadow-glow-cyan"
        size="lg"
        disabled={isCheckingEmail || !email.trim()}
      >
        {isCheckingEmail
          ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          )
          : (
            "Continue with email"
          )}
      </Button>
    </form>
  );

  const renderPasswordStep = () => (
    <form onSubmit={handleSignIn} className="space-y-4" autoComplete="off">
      <div className="space-y-2">
        <Input
          id="email-display"
          type="email"
          value={email}
          disabled
          className="h-12 bg-muted"
        />
      </div>

      <div className="space-y-2">
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={e =>
            setPassword(e.target.value)}
          required
          disabled={isLoading}
          className="h-12"
          autoComplete="current-password"
          ref={passwordInputRef}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        className="w-full shadow-glow-cyan"
        size="lg"
        disabled={isLoading || !password}
      >
        {isLoading
          ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          )
          : (
            "Sign In"
          )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={handleBack}
        disabled={isLoading}
      >
        Use different email
      </Button>
    </form>
  );

  const renderSignupStep = () => (
    <form onSubmit={handleSignUp} className="space-y-4" autoComplete="off">
      <div className="space-y-2">
        <Input
          id="email-display"
          type="email"
          value={email}
          disabled
          className="h-12 bg-muted"
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Create a password to set up your account.
      </p>

      <div className="space-y-2">
        <Input
          id="password"
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={e =>
            setPassword(e.target.value)}
          required
          disabled={isLoading}
          className="h-12"
          autoComplete="new-password"
          minLength={8}
          ref={passwordInputRef}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        className="w-full shadow-glow-cyan"
        size="lg"
        disabled={isLoading || password.length < 8}
      >
        {isLoading
          ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          )
          : (
            "Create Account"
          )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={handleBack}
        disabled={isLoading}
      >
        Use different email
      </Button>
    </form>
  );

  const renderOAuthOnlyStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          id="email-display"
          type="email"
          value={email}
          disabled
          className="h-12 bg-muted"
        />
      </div>

      <p className="text-sm text-muted-foreground text-center">
        This account was created with Google, Apple, Facebook, or GitHub. Please sign in using one
        of these options.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={handleBack}
      >
        Use different email
      </Button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case "email":
        return renderEmailStep();
      case "password":
        return renderPasswordStep();
      case "signup":
        return renderSignupStep();
      case "oauth-only":
        return renderOAuthOnlyStep();
      default:
        return renderEmailStep();
    }
  };

  const showGoogle = availableProviders === null || availableProviders.has("google");
  const showGitHub = availableProviders === null || availableProviders.has("github");
  const showApple = availableProviders === null || availableProviders.has("apple");
  const hasOAuthButtons = showGoogle || showGitHub || showApple;

  return (
    <div className={`flex flex-col gap-4 w-full max-w-sm ${className || ""}`}>
      {/* Social Buttons - Primary Position */}
      {isLoadingProviders
        ? (
          <div className="flex flex-col gap-3">
            <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
          </div>
        )
        : hasOAuthButtons && (
          <div className="flex flex-col gap-3">
            {showGoogle && (
              <Button
                onClick={() => signIn("google", { callbackUrl: getCallbackUrl() })}
                variant="outline"
                className="w-full h-12 bg-card hover:bg-card/80 border-border"
                size="lg"
              >
                <GoogleIcon className="mr-2 h-5 w-5" />
                Continue with Google
              </Button>
            )}

            {showGitHub && (
              <Button
                onClick={() => signIn("github", { callbackUrl: getCallbackUrl() })}
                variant="outline"
                className="w-full h-12 bg-card hover:bg-card/80 border-border"
                size="lg"
              >
                <GitHubIcon className="mr-2 h-5 w-5" />
                Continue with GitHub
              </Button>
            )}

            {showApple && (
              <Button
                onClick={() => signIn("apple", { callbackUrl: getCallbackUrl() })}
                variant="outline"
                className="w-full h-12 bg-black hover:bg-black/90 border-black text-white"
                size="lg"
              >
                <AppleIcon className="mr-2 h-5 w-5" />
                Continue with Apple
              </Button>
            )}
          </div>
        )}

      {/* Separator - only show when OAuth buttons are present */}
      {!isLoadingProviders && hasOAuthButtons && (
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-4 text-muted-foreground">
              or
            </span>
          </div>
        </div>
      )}

      {/* Email Form */}
      {renderCurrentStep()}
    </div>
  );
}

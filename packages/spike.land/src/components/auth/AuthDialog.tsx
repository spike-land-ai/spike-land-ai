"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { signIn } from "@/lib/auth/client/actions";
import { useSession } from "@/lib/auth/client/hooks";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, ChevronDown, Loader2, Mail, QrCode, Zap } from "lucide-react";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

type EmailState = "input" | "sending" | "sent";

type QrStatus = "idle" | "loading" | "display" | "polling" | "authenticated" | "expired";

interface QrInitiateResponse {
  token: string;
  hash: string;
}

interface QrPollResponse {
  status: string;
  oneTimeCode?: string;
}

export interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callbackUrl?: string | undefined;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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

function GitHubIcon({ className }: { className?: string }) {
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

function AppleIcon({ className }: { className?: string }) {
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

export function AuthDialog({ open, onOpenChange, callbackUrl }: AuthDialogProps) {
  const isMobile = useIsMobile();
  const { update: updateSession } = useSession();

  // Email state
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<EmailState>("input");
  const [emailError, setEmailError] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // QR state
  const [qrToken, setQrToken] = useState("");
  const [qrExpiry, setQrExpiry] = useState(0);
  const [qrStatus, setQrStatus] = useState<QrStatus>("idle");
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // OAuth collapsible
  const [oauthOpen, setOauthOpen] = useState(false);

  useEffect(() => {
    // Better Auth doesn't require dynamic fetching of providers
  }, []);

  const getCallbackUrl = useCallback((): string => {
    if (callbackUrl) return callbackUrl;
    if (typeof window === "undefined") return "/";
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("callbackUrl") || "/";
    try {
      const url = new URL(raw, window.location.origin);
      if (url.origin === window.location.origin) {
        return url.pathname + url.search;
      }
    } catch {
      // Malformed URL; use default
    }
    return "/";
  }, [callbackUrl]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setEmail("");
      setEmailState("input");
      setEmailError("");
      setResendCountdown(0);
      setQrStatus("idle");
      setQrToken("");
      setOauthOpen(false);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
    }
  }, [open]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Clean up QR polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
    };
  }, []);

  // --- Email handlers ---
  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setEmailState("sending");
    setEmailError("");

    try {
      const result = await signIn("email", {
        email: email.trim().toLowerCase(),
        redirect: false,
        callbackUrl: getCallbackUrl(),
      });

      if (result?.error) {
        setEmailError("Failed to send sign-in link. Please try again.");
        setEmailState("input");
      } else {
        setEmailState("sent");
        setResendCountdown(60);
      }
    } catch {
      setEmailError("An error occurred. Please try again.");
      setEmailState("input");
    }
  };

  const handleResend = async () => {
    if (resendCountdown > 0) return;
    setEmailState("sending");

    try {
      const result = await signIn("email", {
        email: email.trim().toLowerCase(),
        redirect: false,
        callbackUrl: getCallbackUrl(),
      });

      if (result?.error) {
        setEmailError("Failed to resend. Please try again.");
      } else {
        setResendCountdown(60);
      }
      setEmailState("sent");
    } catch {
      setEmailError("An error occurred. Please try again.");
      setEmailState("sent");
    }
  };

  // --- QR handlers ---
  const initiateQR = useCallback(async () => {
    setQrStatus("loading");

    try {
      const response = await fetch("/api/auth/qr/initiate", { method: "POST" });
      if (!response.ok) {
        setQrStatus("idle");
        return;
      }

      const data = (await response.json()) as QrInitiateResponse;
      setQrToken(data.token);
      setQrExpiry(300); // 5 minutes
      setQrStatus("display");

      // Start polling
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/auth/qr/poll?hash=${data.hash}`);
          if (!pollRes.ok) {
            setQrStatus("expired");
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            return;
          }

          const pollData = (await pollRes.json()) as QrPollResponse;
          if (pollData.status === "APPROVED") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
            setQrStatus("authenticated");

            const authResult = await signIn("qr-auth", {
              qrHash: data.hash,
              qrOneTimeCode: pollData.oneTimeCode,
              redirect: false,
            });

            if (!authResult?.error) {
              await updateSession();
              toast.success("Welcome! You're now signed in.");
              onOpenChange(false);

              const cb = getCallbackUrl();
              if (cb && cb !== "/" && cb !== window.location.pathname) {
                window.location.href = cb;
              }
            } else {
              setQrStatus("expired");
              toast.error("QR authentication failed. Please try again.");
            }
          }
        } catch {
          // Silently retry on network errors
        }
      }, 3000);

      // Start expiry countdown
      expiryIntervalRef.current = setInterval(() => {
        setQrExpiry((prev) => {
          if (prev <= 1) {
            setQrStatus("expired");
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (expiryIntervalRef.current) clearInterval(expiryIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setQrStatus("idle");
    }
  }, [getCallbackUrl, onOpenChange, updateSession]);

  // Auto-initiate QR when switching to QR tab
  const handleTabChange = (value: string) => {
    if (value === "qr" && qrStatus === "idle") {
      void initiateQR();
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const qrUrl =
    qrToken && typeof window !== "undefined"
      ? `${window.location.origin}/auth/qr-verify?token=${qrToken}`
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden bg-card/80 backdrop-blur-3xl border border-border rounded-3xl shadow-2xl">
        {/* Ambient gradient accent at the top of the card */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -left-20 h-48 w-48 rounded-full bg-violet-600/10 blur-[60px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-cyan-500/8 blur-[50px]"
        />

        <DialogHeader className="px-6 pt-7 pb-2 relative">
          {/* Brand wordmark */}
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-cyan-400" aria-hidden="true" />
            <span className="text-base font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              spike.land
            </span>
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Sign in to your account
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            The AI development platform
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 relative">
          <Tabs defaultValue="email" onValueChange={handleTabChange}>
            <TabsList className="w-full mb-4">
              <TabsTrigger value="email" className="flex-1 gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              {!isMobile && (
                <TabsTrigger value="qr" className="flex-1 gap-2">
                  <QrCode className="h-4 w-4" />
                  QR Code
                </TabsTrigger>
              )}
            </TabsList>

            {/* Email Tab */}
            <TabsContent value="email" className="mt-0">
              {emailState === "input" && (
                <form onSubmit={handleSendMagicLink} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12"
                    autoComplete="email"
                  />
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                  <Button
                    type="submit"
                    className="w-full rounded-full"
                    size="lg"
                    disabled={!email.trim()}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Send magic link
                  </Button>
                </form>
              )}

              {emailState === "sending" && (
                <div className="flex flex-col items-center py-8 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Sending magic link...</p>
                </div>
              )}

              {emailState === "sent" && (
                <div className="flex flex-col items-center py-6 gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Mail className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-lg text-foreground">Check your email</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      We sent a sign-in link to <strong>{email}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      The link expires in 10 minutes.
                    </p>
                  </div>
                  {emailError && <p className="text-sm text-destructive">{emailError}</p>}
                  <Button
                    variant="ghost"
                    onClick={handleResend}
                    disabled={resendCountdown > 0}
                    className="text-sm rounded-full"
                  >
                    {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend link"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEmailState("input");
                      setEmailError("");
                    }}
                    className="text-xs text-muted-foreground rounded-full"
                  >
                    <ArrowLeft className="mr-1 h-3 w-3" />
                    Use different email
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* QR Tab (desktop only) */}
            {!isMobile && (
              <TabsContent value="qr" className="mt-0">
                <div className="flex flex-col items-center py-4 gap-4">
                  {(qrStatus === "idle" || qrStatus === "loading") && (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Generating QR code...</p>
                    </>
                  )}

                  {qrStatus === "display" && (
                    <>
                      <div className="rounded-xl border border-border bg-white p-4">
                        <QRCodeSVG value={qrUrl} size={200} level="M" includeMargin={false} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">Scan with your phone</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Open the camera app on your phone and scan this code
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Expires in {formatTime(qrExpiry)}
                        </p>
                      </div>
                    </>
                  )}

                  {qrStatus === "polling" && (
                    <>
                      <div className="rounded-xl border border-border bg-white p-4 opacity-50">
                        <QRCodeSVG value={qrUrl} size={200} level="M" includeMargin={false} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Waiting for approval...</p>
                      </div>
                    </>
                  )}

                  {qrStatus === "authenticated" && (
                    <>
                      <CheckCircle className="h-12 w-12 text-green-500" />
                      <p className="text-sm font-medium text-foreground">Signed in!</p>
                    </>
                  )}

                  {qrStatus === "expired" && (
                    <>
                      <p className="text-sm text-muted-foreground">QR code expired</p>
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={() => void initiateQR()}
                      >
                        Generate new code
                      </Button>
                    </>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          {(() => {
            const showGoogle = true;
            const showGitHub = true;
            const showApple = true;
            const hasOAuthOptions = showGoogle || showGitHub || showApple;

            if (!hasOAuthOptions) return null;

            return (
              <Collapsible open={oauthOpen} onOpenChange={setOauthOpen} className="mt-4">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>More sign-in options</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${oauthOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {showGoogle && (
                    <Button
                      onClick={() => signIn("google", { callbackUrl: getCallbackUrl() })}
                      variant="outline"
                      className="w-full h-11 rounded-full hover:border-cyan-400/50 hover:text-foreground transition-colors"
                    >
                      <GoogleIcon className="mr-2 h-4 w-4" />
                      Continue with Google
                    </Button>
                  )}
                  {showGitHub && (
                    <Button
                      onClick={() => signIn("github", { callbackUrl: getCallbackUrl() })}
                      variant="outline"
                      className="w-full h-11 rounded-full hover:border-cyan-400/50 hover:text-foreground transition-colors"
                    >
                      <GitHubIcon className="mr-2 h-4 w-4" />
                      Continue with GitHub
                    </Button>
                  )}
                  {showApple && (
                    <Button
                      onClick={() => signIn("apple", { callbackUrl: getCallbackUrl() })}
                      variant="outline"
                      className="w-full h-11 rounded-full bg-black hover:bg-black/90 text-white border-black"
                    >
                      <AppleIcon className="mr-2 h-4 w-4" />
                      Continue with Apple
                    </Button>
                  )}
                </CollapsibleContent>
              </Collapsible>
            );
          })()}

          {/* Bottom hairline gradient */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

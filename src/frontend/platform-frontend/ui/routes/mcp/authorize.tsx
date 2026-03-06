import { useAuth } from "../../hooks/useAuth";
import { AuthGuard } from "../../components/AuthGuard";
import { useSearch } from "@tanstack/react-router";
import { useState } from "react";

export function McpAuthorizePage() {
  return (
    <AuthGuard>
      <AuthorizeForm />
    </AuthGuard>
  );
}

function AuthorizeForm() {
  const { user } = useAuth();
  const search = useSearch({ strict: false }) as { user_code?: string };
  const [userCode, setUserCode] = useState(search.user_code ?? "");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleApprove = async () => {
    if (!userCode.trim()) return;
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/oauth/device/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_code: userCode.trim() }),
        credentials: "include",
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setErrorMessage((data as { error?: string }).error ?? "Code expired or invalid.");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card dark:glass-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-3xl text-success">
            &#10003;
          </div>
          <h1 className="text-xl font-bold text-foreground">Device Authorized</h1>
          <p className="text-sm text-muted-foreground">
            You can close this window and return to your MCP client.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card dark:glass-card p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground shadow-lg shadow-primary/20">
            S
          </div>
          <h1 className="text-xl font-bold text-foreground">Authorize Device</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirm the code shown in your MCP client to grant access.
          </p>
        </div>

        {user && (
          <p className="text-center text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.name ?? user.email}</span>
          </p>
        )}

        <div className="space-y-2">
          <label htmlFor="user-code" className="block text-sm font-medium text-foreground">
            Device Code
          </label>
          <input
            id="user-code"
            type="text"
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            placeholder="XXXX-XXXX"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-center text-2xl font-mono tracking-widest text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={status === "submitting"}
          />
        </div>

        {status === "error" && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <button
          onClick={handleApprove}
          disabled={status === "submitting" || !userCode.trim()}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {status === "submitting" ? "Authorizing..." : "Approve"}
        </button>
      </div>
    </div>
  );
}

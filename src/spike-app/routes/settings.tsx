import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { apiUrl } from "@/lib/api";

type SettingsTab = "profile" | "whatsapp" | "keys" | "billing" | "access";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "keys", label: "API Keys" },
  { id: "billing", label: "Billing" },
  { id: "access", label: "Access" },
];

type Provider = "openai" | "anthropic" | "google" | "mistral";

interface ApiKey {
  id: string;
  provider: Provider;
  key: string;
  createdAt?: string;
}

const PROVIDERS: Provider[] = ["openai", "anthropic", "google", "mistral"];

// ---------- Profile Tab ----------

function ProfileTab() {
  const { user, isAuthenticated } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/user/profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameRef.current?.value,
          email: emailRef.current?.value,
        }),
      });
      if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-foreground">
          Display Name
        </label>
        <input
          ref={nameRef}
          id="displayName"
          type="text"
          defaultValue={isAuthenticated ? (user?.name ?? "") : ""}
          className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Your name"
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          ref={emailRef}
          id="email"
          type="email"
          defaultValue={isAuthenticated ? (user?.email ?? "") : ""}
          className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="you@example.com"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-muted-foreground">Saved successfully.</span>}
      </div>
    </div>
  );
}

// ---------- WhatsApp Tab ----------

function WhatsAppTab() {
  const [linked, setLinked] = useState(false);
  const [phone] = useState("+1 *** *** 4291");
  const [otp, setOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/whatsapp/link/initiate", { method: "POST" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json() as { otp: string };
      setOtp(data.otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/whatsapp/link", { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setLinked(false);
      setOtp(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            Status: {linked ? "Linked" : "Not linked"}
          </p>
          {linked && (
            <p className="text-xs text-muted-foreground">{phone}</p>
          )}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            linked
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {linked ? "Linked" : "Unlinked"}
        </span>
      </div>

      {otp && (
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="mb-1 text-sm font-medium text-foreground">Your OTP Code</p>
          <p className="font-mono text-2xl tracking-widest text-primary">{otp}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Text this code to the spike.land bot on WhatsApp to complete linking.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        {!linked && (
          <button
            onClick={handleLink}
            disabled={loading}
            className="rounded-lg bg-primary px-5 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Initiating..." : "Link WhatsApp"}
          </button>
        )}
        {linked && (
          <button
            onClick={handleUnlink}
            disabled={loading}
            className="rounded-lg border border-destructive/30 px-5 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {loading ? "Unlinking..." : "Unlink"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- API Keys Tab ----------

function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("openai");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchKeys() {
      try {
        const res = await fetch(apiUrl("/keys"));
        if (!res.ok) return;
        const data = await res.json() as { keys: ApiKey[] };
        setKeys(data.keys);
      } catch {
        // silently ignore
      } finally {
        setLoadingKeys(false);
      }
    }
    void fetchKeys();
  }, []);

  async function handleSaveKey() {
    if (!newKeyValue.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/keys"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, encryptedKey: newKeyValue }),
      });
      if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
      const data = await res.json() as { id: string; provider: string; createdAt: string };
      setKeys((prev) => [
        { id: data.id, provider: selectedProvider, key: "****", createdAt: data.createdAt },
        ...prev,
      ]);
      setNewKeyValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(key: ApiKey) {
    setTestingId(key.id);
    try {
      const res = await fetch(apiUrl(`/keys/${key.id}/test`), { method: "POST" });
      const data = await res.json() as { valid: boolean; status?: number };
      setTestResults((prev) => ({
        ...prev,
        [key.id]: data.valid ? "OK" : `Failed (${data.status ?? "unknown"})`,
      }));
    } catch {
      setTestResults((prev) => ({ ...prev, [key.id]: "Error" }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(apiUrl(`/keys/${id}`), { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch {
      // silently ignore
    }
  }

  return (
    <div className="space-y-6">
      {/* Existing keys */}
      {loadingKeys ? (
        <p className="text-sm text-muted-foreground">Loading keys...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No API keys stored yet.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium capitalize text-foreground">{key.provider}</p>
                <p className="font-mono text-xs text-muted-foreground">{key.key}</p>
                {key.createdAt && (
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(key.createdAt).toLocaleDateString()}
                  </p>
                )}
                {testResults[key.id] && (
                  <p
                    className={`text-xs ${
                      testResults[key.id] === "OK" ? "text-green-600" : "text-destructive"
                    }`}
                  >
                    {testResults[key.id]}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTest(key)}
                  disabled={testingId === key.id}
                  className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {testingId === key.id ? "Testing..." : "Test"}
                </button>
                <button
                  onClick={() => handleDelete(key.id)}
                  className="rounded-lg border border-destructive/30 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add key form */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Add API Key</p>
        <div className="flex gap-2">
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as Provider)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p} className="capitalize">
                {p}
              </option>
            ))}
          </select>
          <input
            type="password"
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            placeholder="Paste your API key"
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSaveKey}
            disabled={saving || !newKeyValue.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

// ---------- Billing Tab ----------

type Plan = "free" | "pro" | "business";
type SubscriptionStatus = "active" | "canceled" | "past_due";

interface BillingStatus {
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodEnd: number | null;
  usage: number;
}

const USAGE_LIMITS: Record<Plan, number> = {
  free: 50,
  pro: 500,
  business: 5000,
};

const planColors: Record<Plan, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  business: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

function BillingTab() {
  const { showToast } = useToast();
  const search = useSearch({ strict: false }) as { success?: string; canceled?: string };

  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
  const toastShownRef = useRef(false);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch(apiUrl("/billing/status"));
        if (!res.ok) return;
        const data = await res.json() as BillingStatus;
        setBilling(data);
      } catch {
        // silently ignore
      } finally {
        setLoadingBilling(false);
      }
    }
    void fetchBilling();
  }, []);

  useEffect(() => {
    if (toastShownRef.current) return;
    if (search.success === "1") {
      toastShownRef.current = true;
      showToast("Subscription activated!", "success");
    } else if (search.canceled === "1") {
      toastShownRef.current = true;
      showToast("Checkout canceled", "info");
    }
  }, [search.success, search.canceled, showToast]);

  async function handleUpgrade(tier: "pro" | "business") {
    setUpgrading(true);
    try {
      const res = await fetch(apiUrl("/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        showToast(err.error ?? "Checkout failed", "error");
        return;
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } finally {
      setUpgrading(false);
    }
  }

  async function handleManageSubscription() {
    setManagingPortal(true);
    try {
      const res = await fetch(apiUrl("/billing/cancel"), { method: "POST" });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        showToast(err.error ?? "Failed to open billing portal", "error");
        return;
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } finally {
      setManagingPortal(false);
    }
  }

  if (loadingBilling) {
    return <p className="text-sm text-muted-foreground">Loading billing info...</p>;
  }

  const plan = billing?.plan ?? "free";
  const status = billing?.status ?? "active";
  const usage = billing?.usage ?? 0;
  const usageLimit = USAGE_LIMITS[plan];
  const usagePct = Math.min((usage / usageLimit) * 100, 100);
  const periodEnd = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd * 1000).toLocaleDateString()
    : null;

  return (
    <div className="space-y-6">
      {/* Past due warning */}
      {status === "past_due" && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-50 px-4 py-3 dark:bg-yellow-900/10">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
            Payment past due — please update your payment method to avoid service interruption.
          </p>
        </div>
      )}

      {/* Canceled notice */}
      {status === "canceled" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            Your subscription has been canceled. Resubscribe below to regain access.
          </p>
        </div>
      )}

      {/* Current plan */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-4">
        <div>
          <p className="text-sm text-muted-foreground">Current Plan</p>
          <p className="mt-1 text-lg font-semibold capitalize text-foreground">{plan}</p>
          {periodEnd && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === "canceled" ? "Access until" : "Renews"} {periodEnd}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${planColors[plan]}`}>
            {plan}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
            status === "active"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : status === "past_due"
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              : "bg-muted text-muted-foreground"
          }`}>
            {status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Usage stats */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-2">
        <p className="text-sm font-medium text-foreground">Usage — Current Period</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePct >= 90 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {usage} / {usageLimit} messages
          </span>
        </div>
        {periodEnd && (
          <p className="text-xs text-muted-foreground">Resets {periodEnd}</p>
        )}
      </div>

      {/* Manage subscription (paid plans) */}
      {plan !== "free" && (
        <button
          type="button"
          onClick={handleManageSubscription}
          disabled={managingPortal}
          className="w-full rounded-lg border border-border px-6 py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {managingPortal ? "Opening portal..." : "Manage Subscription"}
        </button>
      )}

      {/* Upgrade buttons */}
      {(plan === "free" || status === "canceled") && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {plan !== "pro" && (
            <button
              type="button"
              onClick={() => handleUpgrade("pro")}
              disabled={upgrading}
              className="flex-1 rounded-lg bg-blue-600 px-6 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {upgrading ? "Redirecting..." : "Upgrade to Pro — $29/mo"}
            </button>
          )}
          {plan !== "business" && (
            <button
              type="button"
              onClick={() => handleUpgrade("business")}
              disabled={upgrading}
              className="flex-1 rounded-lg bg-purple-600 px-6 py-2.5 text-center text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {upgrading ? "Redirecting..." : "Upgrade to Business — $99/mo"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Access Tab ----------

interface EloEvent {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
}

function AccessTab() {
  const eloScore = 850;
  const eloHistory: EloEvent[] = [];
  const bugBountyEligible = eloScore >= 1000;

  function getTier(score: number): { label: string; color: string } {
    if (score >= 1500) return { label: "Elite", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" };
    if (score >= 1000) return { label: "Pro", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
    return { label: "Free", color: "bg-muted text-muted-foreground" };
  }

  const tier = getTier(eloScore);

  return (
    <div className="space-y-6">
      {/* ELO score */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-background px-5 py-4">
        <div>
          <p className="text-sm text-muted-foreground">ELO Score</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{eloScore}</p>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-sm font-semibold ${tier.color}`}>
          {tier.label}
        </span>
      </div>

      {/* Tier thresholds */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Tier Thresholds</p>
        <div className="space-y-2">
          {[
            { label: "Free", range: "0 – 999", color: "bg-muted" },
            { label: "Pro", range: "1000 – 1499", color: "bg-blue-500" },
            { label: "Elite", range: "1500+", color: "bg-purple-500" },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${t.color}`} />
              <span className="text-sm font-medium text-foreground w-12">{t.label}</span>
              <span className="text-sm text-muted-foreground">{t.range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bug bounty */}
      <div className="rounded-lg border border-border bg-background px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-foreground">Bug Bounty Eligibility</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            bugBountyEligible
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {bugBountyEligible ? "Eligible" : "Not eligible (need 1000+)"}
        </span>
      </div>

      {/* ELO history */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Recent ELO Events</p>
        {eloHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent events.</p>
        ) : (
          <div className="space-y-1">
            {eloHistory.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted"
              >
                <span className="text-sm text-foreground">{event.reason}</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${
                      event.delta >= 0 ? "text-green-600" : "text-destructive"
                    }`}
                  >
                    {event.delta >= 0 ? "+" : ""}{event.delta}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Settings Page ----------

export function SettingsPage() {
  const search = useSearch({ strict: false }) as { tab?: string };
  const navigate = useNavigate();

  const validTabs = TABS.map((t) => t.id);
  const activeTab: SettingsTab =
    validTabs.includes(search.tab as SettingsTab) ? (search.tab as SettingsTab) : "profile";

  const setTab = useCallback(
    (tab: SettingsTab) => {
      navigate({ to: "/settings", search: (prev) => ({ ...prev, tab }) });
    },
    [navigate],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "whatsapp" && <WhatsAppTab />}
        {activeTab === "keys" && <ApiKeysTab />}
        {activeTab === "billing" && <BillingTab />}
        {activeTab === "access" && <AccessTab />}
      </div>
    </div>
  );
}

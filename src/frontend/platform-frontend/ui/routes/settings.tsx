import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { trackAnalyticsEvent } from "../hooks/useAnalytics";
import { useToast } from "../components/Toast";
import { usePricing } from "../hooks/usePricing";
import { AuthGuard } from "../components/AuthGuard";
import { CreditWidget } from "../components/CreditWidget";
import { apiUrl } from "../../core-logic/api";
import { trackPurchaseConversion, getStoredGclid } from "../../core-logic/google-ads";
import { UI_ANIMATIONS } from "@spike-land-ai/shared/constants";

type SettingsTab = "profile" | "whatsapp" | "keys" | "billing" | "access";

const TABS: { id: SettingsTab }[] = [
  { id: "profile" },
  { id: "whatsapp" },
  { id: "keys" },
  { id: "billing" },
  { id: "access" },
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
  const { t } = useTranslation("settings");
  const { user, isAuthenticated } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const name = nameRef.current?.value.trim() ?? "";
    const email = emailRef.current?.value.trim() ?? "";
    if (!name) {
      setError(t("profile.nameRequired"));
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("profile.emailRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/user/profile"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), UI_ANIMATIONS.LONG_FEEDBACK_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unknown"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="displayName" className="mb-1 block text-sm font-medium text-foreground">
          {t("profile.displayName")}
        </label>
        <input
          ref={nameRef}
          id="displayName"
          type="text"
          defaultValue={isAuthenticated ? (user?.name ?? "") : ""}
          className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t("profile.namePlaceholder")}
        />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
          {t("profile.email")}
        </label>
        <input
          ref={emailRef}
          id="email"
          type="email"
          defaultValue={isAuthenticated ? (user?.email ?? "") : ""}
          className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t("profile.emailPlaceholder")}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? t("profile.saving") : t("profile.saveChanges")}
        </button>
        {saved && (
          <span className="text-sm text-muted-foreground">{t("profile.savedSuccess")}</span>
        )}
      </div>
    </div>
  );
}

// ---------- WhatsApp Tab ----------

const OTP_TTL_SECONDS = 300;

function WhatsAppTab() {
  const { t } = useTranslation("settings");
  const [linked, setLinked] = useState(false);
  const [phone] = useState("+1 *** *** 4291");
  const [otp, setOtp] = useState<string | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!otp) return;
    setOtpSecondsLeft(OTP_TTL_SECONDS);
    const interval = setInterval(() => {
      setOtpSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          setOtp(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [otp]);

  async function handleLink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/whatsapp/link/initiate"), { method: "POST" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { otp: string };
      setOtp(data.otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unknown"));
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlink() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/whatsapp/link"), { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setLinked(false);
      setOtp(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unknown"));
    } finally {
      setLoading(false);
    }
  }

  const otpTime = `${Math.floor(otpSecondsLeft / 60)}:${String(otpSecondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("whatsapp.statusLabel")}:{" "}
            {linked ? t("whatsapp.statusLinked") : t("whatsapp.statusNotLinked")}
          </p>
          {linked && <p className="text-xs text-muted-foreground">{phone}</p>}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            linked
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {linked ? t("whatsapp.statusLinked") : t("whatsapp.statusNotLinked")}
        </span>
      </div>

      {otp && (
        <div className="rounded-lg border border-border bg-muted p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{t("whatsapp.otpTitle")}</p>
            <span className="text-xs text-muted-foreground">
              {t("whatsapp.otpExpires", { time: otpTime })}
            </span>
          </div>
          <p className="font-mono text-2xl tracking-widest text-primary">{otp}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t("whatsapp.otpInstructions")}</p>
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
            {loading ? t("whatsapp.linking") : t("whatsapp.linkButton")}
          </button>
        )}
        {linked && (
          <button
            onClick={handleUnlink}
            disabled={loading}
            className="rounded-lg border border-destructive/30 px-5 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {loading ? t("whatsapp.unlinking") : t("whatsapp.unlinkButton")}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- API Keys Tab ----------

function ApiKeysTab() {
  const { t } = useTranslation("settings");
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
        const data = (await res.json()) as { keys: ApiKey[] };
        setKeys(data.keys.map((k) => ({ ...k, key: "****" })));
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
        body: JSON.stringify({ provider: selectedProvider, apiKey: newKeyValue }),
      });
      if (!res.ok) throw new Error(`Failed to save: ${res.status}`);
      const data = (await res.json()) as { id: string; provider: string; createdAt: string };
      setKeys((prev) => [
        { id: data.id, provider: selectedProvider, key: "****", createdAt: data.createdAt },
        ...prev,
      ]);
      setNewKeyValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unknown"));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(key: ApiKey) {
    setTestingId(key.id);
    try {
      const res = await fetch(apiUrl(`/keys/${key.id}/test`), { method: "POST" });
      const data = (await res.json()) as { valid: boolean; status?: number };
      setTestResults((prev) => ({
        ...prev,
        [key.id]: data.valid
          ? t("apiKeys.statusOk")
          : t("apiKeys.statusFailed", { code: data.status ?? "unknown" }),
      }));
    } catch {
      setTestResults((prev) => ({ ...prev, [key.id]: t("apiKeys.statusError") }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(apiUrl(`/keys/${id}`), { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.deleteKeyFailed"));
    }
  }

  return (
    <div className="space-y-6">
      {/* Existing keys */}
      {loadingKeys ? (
        <p className="text-sm text-muted-foreground">{t("apiKeys.loadingKeys")}</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("apiKeys.noKeysYet")}</p>
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
                    {t("apiKeys.addedOn", { date: new Date(key.createdAt).toLocaleDateString() })}
                  </p>
                )}
                {testResults[key.id] && (
                  <p
                    className={`text-xs ${
                      testResults[key.id] === t("apiKeys.statusOk")
                        ? "text-green-600"
                        : "text-destructive"
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
                  {testingId === key.id ? t("apiKeys.testing") : t("apiKeys.test")}
                </button>
                <button
                  onClick={() => handleDelete(key.id)}
                  className="rounded-lg border border-destructive/30 px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  {t("apiKeys.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add key form */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">{t("apiKeys.addKey")}</p>
        <div className="flex gap-2">
          <label htmlFor="apiKeyProvider" className="sr-only">
            {t("apiKeys.provider")}
          </label>
          <select
            id="apiKeyProvider"
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
          <label htmlFor="apiKeyValue" className="sr-only">
            {t("apiKeys.apiKeyLabel")}
          </label>
          <input
            id="apiKeyValue"
            type="password"
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            placeholder={t("apiKeys.pastePlaceholder")}
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSaveKey}
            disabled={saving || !newKeyValue.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t("apiKeys.saving") : t("apiKeys.save")}
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

const planColors: Record<Plan, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  business: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

function BillingTab() {
  const { t } = useTranslation("settings");
  const { showToast } = useToast();
  const { pricing } = usePricing();
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
        const data = (await res.json()) as BillingStatus;
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
      trackAnalyticsEvent("checkout_success", { source: "stripe_redirect" });
      trackPurchaseConversion();
      showToast(t("billing.activated"), "success");
    } else if (search.canceled === "1") {
      toastShownRef.current = true;
      showToast(t("billing.canceledToast"), "info");
    }
  }, [search.success, search.canceled, showToast, t]);

  async function handleUpgrade(tier: "pro" | "business") {
    setUpgrading(true);
    try {
      const gclid = getStoredGclid();
      const res = await fetch(apiUrl("/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, ...(gclid && { gclid }) }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        showToast(err.error ?? t("errors.checkoutFailed"), "error");
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
      const res = await fetch(apiUrl("/billing/portal"), { method: "POST" });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        showToast(err.error ?? t("errors.openPortalFailed"), "error");
        return;
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } finally {
      setManagingPortal(false);
    }
  }

  if (loadingBilling) {
    return <p className="text-sm text-muted-foreground">{t("billing.loadingInfo")}</p>;
  }

  const plan = billing?.plan ?? "free";
  const status = billing?.status ?? "active";
  const planLabel =
    plan === "free"
      ? t("billing.planFree")
      : plan === "pro"
        ? t("billing.planPro")
        : t("billing.planBusiness");
  const periodEnd = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd * 1000).toLocaleDateString()
    : null;

  const statusLabel =
    status === "active"
      ? t("billing.statusActive")
      : status === "canceled"
        ? t("billing.statusCanceled")
        : t("billing.statusPastDue");

  return (
    <div className="space-y-6">
      {/* Past due warning */}
      {status === "past_due" && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-50 px-4 py-3 dark:bg-yellow-900/10">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
            {t("billing.pastDueWarning")}
          </p>
        </div>
      )}

      {/* Canceled notice */}
      {status === "canceled" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">{t("billing.canceledWarning")}</p>
        </div>
      )}

      {/* Current plan */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-4">
        <div>
          <p className="text-sm text-muted-foreground">{t("billing.currentPlan")}</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{planLabel}</p>
          {periodEnd && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === "canceled" ? t("billing.accessUntil") : t("billing.renews")} {periodEnd}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${planColors[plan]}`}>
            {planLabel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              status === "active"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : status === "past_due"
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Credit balance */}
      <CreditWidget />

      {/* Manage subscription (paid plans) */}
      {plan !== "free" && (
        <button
          type="button"
          onClick={handleManageSubscription}
          disabled={managingPortal}
          className="w-full rounded-lg border border-border px-6 py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
        >
          {managingPortal ? t("billing.openingPortal") : t("billing.manageSubscription")}
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
              {upgrading ? t("billing.redirecting") : t("billing.upgradeToPro", { price: 29 })}
            </button>
          )}
          {plan !== "business" && (
            <button
              type="button"
              onClick={() => handleUpgrade("business")}
              disabled={upgrading}
              className="flex-1 rounded-lg bg-purple-600 px-6 py-2.5 text-center text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {upgrading ? t("billing.redirecting") : t("billing.upgradeToBusiness", { price: 99 })}
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

function getTierColor(score: number): string {
  if (score >= 1500)
    return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
  if (score >= 1000) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  return "bg-muted text-muted-foreground";
}

function AccessTab() {
  const { t } = useTranslation("settings");
  const eloScore = 850;
  const eloHistory: EloEvent[] = [];
  const bugBountyEligible = eloScore >= 1000;

  const tierColor = getTierColor(eloScore);
  const tierLabel =
    eloScore >= 1500
      ? t("access.eliteTier")
      : eloScore >= 1000
        ? t("access.proTier")
        : t("access.freeTier");

  return (
    <div className="space-y-6">
      {/* ELO score */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-background px-5 py-4">
        <div>
          <p className="text-sm text-muted-foreground">{t("access.eloScore")}</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{eloScore}</p>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-sm font-semibold ${tierColor}`}>
          {tierLabel}
        </span>
      </div>

      {/* Tier thresholds */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">{t("access.tierThresholds")}</p>
        <div className="space-y-2">
          {[
            { label: t("access.freeTier"), color: "bg-muted" },
            { label: t("access.proTier"), color: "bg-blue-500" },
            { label: t("access.eliteTier"), color: "bg-purple-500" },
          ].map((tier) => (
            <div key={tier.label} className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${tier.color}`} />
              <span className="text-sm font-medium text-foreground">{tier.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bug bounty */}
      <div className="rounded-lg border border-border bg-background px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-foreground">{t("access.bugBountyEligibility")}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            bugBountyEligible
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {bugBountyEligible ? t("access.eligible") : t("access.notEligible")}
        </span>
      </div>

      {/* ELO history */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t("access.recentEvents")}</p>
        {eloHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("access.noRecentEvents")}</p>
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
                    {event.delta >= 0 ? "+" : ""}
                    {event.delta}
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
  const { t } = useTranslation("settings");
  const search = useSearch({ strict: false }) as { tab?: string };
  const navigate = useNavigate();

  const validTabs = TABS.map((tab) => tab.id);
  const activeTab: SettingsTab = validTabs.includes(search.tab as SettingsTab)
    ? (search.tab as SettingsTab)
    : "profile";

  const setTab = useCallback(
    (tab: SettingsTab) => {
      navigate({ to: "/settings", search: (prev) => ({ ...prev, tab }) });
    },
    [navigate],
  );

  const tabLabels: Record<SettingsTab, string> = {
    profile: t("tabs.profile"),
    whatsapp: t("tabs.whatsapp"),
    keys: t("tabs.apiKeys"),
    billing: t("tabs.billing"),
    access: t("tabs.access"),
  };

  return (
    <AuthGuard>
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label={t("sectionsLabel")}
          className="flex gap-1 border-b border-border overflow-x-auto"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`settings-panel-${tab.id}`}
              id={`settings-tab-${tab.id}`}
              onClick={() => setTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tabLabels[tab.id]}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          role="tabpanel"
          id={`settings-panel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
          className="rounded-2xl border border-border bg-card dark:glass-card p-6 shadow-sm"
        >
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "whatsapp" && <WhatsAppTab />}
          {activeTab === "keys" && <ApiKeysTab />}
          {activeTab === "billing" && <BillingTab />}
          {activeTab === "access" && <AccessTab />}
        </div>
      </div>
    </AuthGuard>
  );
}

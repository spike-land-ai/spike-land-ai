import { useAuth } from "../hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Settings, LogOut, ChevronDown, CreditCard, Loader2 } from "lucide-react";
import { Button } from "../shared/ui/button";
import { cn } from "../../styling/cn";

export function LoginButton() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const { t } = useTranslation(["auth", "common"]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (isLoading) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/88 shadow-[var(--panel-shadow)] animate-pulse">
        <Loader2
          className="size-4 animate-spin text-muted-foreground/50"
          aria-label={t("common:loading")}
        />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Button
        onClick={() => login()}
        className={cn(
          "rounded-[calc(var(--radius-control)-0.1rem)] px-5 text-[0.78rem] font-semibold uppercase tracking-[0.16em]",
          "shadow-[0_18px_40px_color-mix(in_srgb,var(--primary-color)_18%,transparent)]",
        )}
      >
        {t("auth:signIn")}
      </Button>
    );
  }

  const initials = (user.name ?? user.email ?? "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={cn(
          "flex items-center gap-2 rounded-2xl border px-1 py-1 shadow-[var(--panel-shadow)] transition-[border-color,background-color,box-shadow] duration-200 sm:pr-3",
          menuOpen
            ? "border-primary/20 bg-card"
            : "border-border bg-card/82 hover:border-primary/18 hover:bg-card",
        )}
        aria-label={`Account menu for ${user.name ?? user.email ?? "User"}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <div className="relative">
          {user.picture ? (
            <img src={user.picture} alt="" className="h-8 w-8 rounded-xl object-cover shadow-sm" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[0.68rem] font-semibold tracking-[0.08em] text-primary-foreground shadow-[0_10px_24px_color-mix(in_srgb,var(--primary-color)_24%,transparent)]">
              {initials}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
        </div>
        <div className="hidden flex-col items-start sm:flex">
          <span className="text-xs font-semibold leading-none tracking-[-0.02em] text-foreground">
            {user.name ?? user.preferred_username ?? "User"}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {t("auth:proMember")}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "hidden sm:block size-3.5 text-muted-foreground transition-transform duration-200",
            menuOpen && "rotate-180",
          )}
        />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className={cn(
            "rubik-panel absolute right-0 top-full z-[100] mt-2 w-56 origin-top-right rounded-[var(--radius-panel)] p-1.5 animate-in fade-in zoom-in-95 duration-200",
          )}
        >
          <div className="mb-1 border-b border-border/50 px-3 py-3">
            <p className="truncate text-sm font-semibold tracking-[-0.03em] text-foreground">
              {user.name ?? "User"}
            </p>
            {user.email && (
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {user.email}
              </p>
            )}
          </div>

          <div className="space-y-0.5">
            <Link
              to="/settings"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium tracking-[0.01em] text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground",
              )}
            >
              <Settings className="size-4" />
              {t("auth:accountSettings")}
            </Link>
            <Link
              to="/settings"
              search={{ tab: "billing" }}
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium tracking-[0.01em] text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground",
              )}
            >
              <CreditCard className="size-4" />
              {t("auth:billingCredits")}
            </Link>
            <div className="h-px bg-border/50 dark:bg-white/10 my-1 mx-2" />
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium tracking-[0.01em] text-destructive transition-colors duration-200 hover:bg-destructive/5",
              )}
            >
              <LogOut className="size-4" />
              {t("auth:logOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
